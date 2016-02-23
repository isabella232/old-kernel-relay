const app = require('express')();
const http = require('http').Server(app);
const uuid = require('node-uuid').v4;
const spawnteract = require('spawnteract');
const enchannel = require('enchannel-zmq-backend');
const fs = require('fs');
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

    kernels[id] = {
      kernel,
      shell: enchannel.createShellSubject(id, kernel.config),
      stdin: enchannel.createStdinSubject(id, kernel.config),
      iopub: enchannel.createIOPubSubject(id, kernel.config),
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
          kernelInfo.kernel.spawn.kill();
          kernelInfo.shell.complete();
          kernelInfo.stdin.complete();
          kernelInfo.iopub.complete();
          fs.unlink(kernelInfo.kernel.connectionFile);
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

// Returns
// kernel.spawn <-- The running process, from child_process.spawn(...)
// kernel.connectionFile <-- Connection file path
// kernel.config <-- Connection information from the file

// Print the ip address and port for the shell channel
// console.log(kernel.config.ip + ':' + kernel.config.shell_port);

exports.listen = function listen(port) {
  http.listen(port, function(){
    console.log(`listening on *:${port}`);
  });
};
