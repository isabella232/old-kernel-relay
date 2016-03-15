const app = require('express')();
const http = require('http').Server(app);
const uuid = require('node-uuid').v4;
const spawnteract = require('spawnteract');
const enchannel = require('enchannel');
const enchannelBackend = require('enchannel-zmq-backend');
const fs = require('fs');
const io = require('socket.io')(http);
const logger = require('./logger');
const kernels = {};
const username = process.env.LOGNAME || process.env.USER || process.env.LNAME || process.env.USERNAME;

app.get('/spawn/*', function(req, res) {
  res.header('Access-Control-Allow-Origin', '*');

  const kernelName = req.url.split('/').slice(-1)[0];
  spawnteract.launch(kernelName).then(kernel => {
    const id = uuid();
    logger.kernelStarted(id, kernelName);

    var disconnectSockets;
    const disconnectedSockets = new Promise(resolve => disconnectSockets = resolve);
    const channels = enchannelBackend.createChannels(id, kernel.config);
    const kernelInfo = kernels[id] = {
      kernel,
      channels,
      shellSocket: io.of('/shell/' + id),
      stdinSocket: io.of('/stdin/' + id),
      iopubSocket: io.of('/iopub/' + id),
      controlSocket: io.of('/control/' + id),
      disconnectSockets,
      createMessage: enchannel.createMessage.bind(username, id),
    };

    // Connect sockets -> enchannel
    function connectSocketZmq(kernelSocket, name) {
      kernelSocket.on('connection', socket => {
        logger.userConnected(socket.request.connection, name, id);
        const observer = kernelInfo.channels[name].subscribe(msg => socket.emit('msg', msg));
        socket.on('msg', msg => kernelInfo.channels[name].next(msg));
        const disconnect = () => {
          if (!observer.isUnsubscribed) {
            observer.unsubscribe();
            logger.userDisconnected(socket.request.connection, name, id);
          }
        };
        socket.on('disconnect', disconnect);
        disconnectedSockets.then(disconnect);
      });
    }

    connectSocketZmq(kernelInfo.shellSocket, 'shell');
    connectSocketZmq(kernelInfo.stdinSocket, 'stdin');
    connectSocketZmq(kernelInfo.iopubSocket, 'iopub');
    connectSocketZmq(kernelInfo.controlSocket, 'control');

    res.send(JSON.stringify({id: id}));
  }).catch(error => {
    res.status(500).send(JSON.stringify({error: 'Could not launch the kernel'}));
    console.error(error);
  });
});

app.get('/shutdown/*', function(req, res) {
  res.header('Access-Control-Allow-Origin', '*');

  const id = req.url.split('/').slice(-1)[0];
  const kernelInfo = kernels[id];
  if (!kernelInfo) {
    res.status(500).send(JSON.stringify({error: 'kernel doesn\' exist'}));
    return;
  }

  enchannel.shutdownRequest(kernelInfo.channels, username, id).then(() => {
    try {
      // Clean-up socket.io namespaces
      delete io.nsps['/shell/' + id];
      delete io.nsps['/stdin/' + id];
      delete io.nsps['/iopub/' + id];
      delete io.nsps['/control/' + id];

      // Clean-up kernel resources
      kernelInfo.kernel.spawn.kill();
      kernelInfo.disconnectSockets();
      fs.unlink(kernelInfo.kernel.connectionFile);

      // Send success
      res.send(JSON.stringify({id: id}));
    } catch(error) {
      res.status(500).send(JSON.stringify({error: 'Could not shutdown the kernel respectfully'}));
      console.error(error);
    }
    delete kernels[id];
    logger.kernelStopped(id);
  }).catch(err => {
    res.status(500).send(JSON.stringify({error: 'Error in shutdown request/response'}));
    console.error(err);
  });
});

exports.listen = function listen(port) {
  http.listen(port, () => logger.startServer(port));
};
