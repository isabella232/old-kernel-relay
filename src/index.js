const app = require('express')();
const http = require('http').Server(app);
const uuid = require('node-uuid').v4;
const spawnteract = require('spawnteract');
const enchannel = require('enchannel-zmq-backend');
const fs = require('fs');
const io = require('socket.io')(http);
const kernels = {};
const username = process.env.LOGNAME || process.env.USER ||
  process.env.LNAME || process.env.USERNAME;

function isChildMessage(msg) {
  return this.header.msg_id === msg.parent_header.msg_id;
}

app.get('/spawn/*', function(req, res) {
  const kernelName = req.url.split('/').slice(-1)[0];
  spawnteract.launch(kernelName).then(kernel => {
    const id = uuid();

    const kernelInfo = kernels[id] = {
      kernel,
      shell: enchannel.createShellSubject(id, kernel.config),
      stdin: enchannel.createStdinSubject(id, kernel.config),
      iopub: enchannel.createIOPubSubject(id, kernel.config),
      shellSocket: io.of('/shell/' + id),
      stdinSocket: io.of('/stdin/' + id),
      iopubSocket: io.of('/iopub/' + id),
      createMessage(msg_type) {
        return {
          header: {
            username,
            id,
            msg_type,
            msg_id: uuid(),
            date: new Date(),
            version: '5.0',
          },
          metadata: {},
          parent_header: {},
          content: {},
        };
      }
    };

    // Connect sockets -> enchannel
    kernelInfo.shellSocket.on('connection', socket => {
      const observer = kernelInfo.shell.subscribe(msg => socket.emit('msg', msg));
      socket.on('msg', msg => kernelInfo.shell.next(msg));
      socket.on('disconnect', () => observer.dispose());
    });
    kernelInfo.stdinSocket.on('connection', socket => {
      const observer = kernelInfo.stdin.subscribe(msg => socket.emit('msg', msg));
      socket.on('msg', msg => kernelInfo.stdin.next(msg));
      socket.on('disconnect', () => observer.dispose());
    });
    kernelInfo.iopubSocket.on('connection', socket => {
      const observer = kernelInfo.iopub.subscribe(msg => socket.emit('msg', msg));
      socket.on('msg', msg => kernelInfo.iopub.next(msg));
      socket.on('disconnect', () => observer.dispose());
    });

    res.send(JSON.stringify({success: id}));
  }).catch(err => {
    res.send(JSON.stringify({error: String(err)}));
  });
});

app.get('/shutdown/*', function(req, res) {
  const id = req.url.split('/').slice(-1)[0];
  const kernelInfo = kernels[id];
  if (!kernelInfo) {
    res.send(JSON.stringify({error: 'kernel doesn\' exist'}));
    return;
  }

  const shutDownRequest = kernelInfo.createMessage('shutdown_request');
  shutDownRequest.content = {
    restart: false
  };

  const shutDownReply = kernelInfo.shell
    .filter(isChildMessage.bind(shutDownRequest))
    .filter(msg => msg.header.msg_type === 'shutdown_reply')
    .map(msg => msg.content)
    .subscribe(content => {
      if (!content.restart) {
        try {

          // Clean-up kernel resources
          kernelInfo.kernel.spawn.kill();
          kernelInfo.shell.complete();
          kernelInfo.stdin.complete();
          kernelInfo.iopub.complete();
          fs.unlink(kernelInfo.kernel.connectionFile);

          // Clean-up socket.io namespaces
          delete io.nsps['/shell/' + id];
          delete io.nsps['/stdin/' + id];
          delete io.nsps['/iopub/' + id];

          // Send success
          res.send(JSON.stringify({success: id}));
        } catch(error) {
          res.send(JSON.stringify({error: String(error)}));
        }
        delete kernels[id];
      }
    });
  kernelInfo.shell.next(shutDownRequest);
});

app.get('/list', function(req, res) {
  res.send(JSON.stringify(Object.keys(kernels)));
});

exports.listen = function listen(port) {
  http.listen(port, function(){
    console.log(`listening on *:${port}`);
  });
};
