# kernel-relay
Server application used to connect an
[enchannel-socketio-backend](https://github.com/nteract/enchannel-socketio-backend)
to a Jupyter kernel.

## Installation

To install kernel relay run

```bash
npm install -g kernel-relay
```

Kernel-relay should be installed on the same machine that the Jupyter kernels
are installed on.  After it's installed, run it using

```bash
kernel-relay
```

## Background
The Jupyter ecosystem has kernels implemented in over 50 languages.  
Unfortunately, by spec, the kernels use ZMQ for communications.  This means
that an application which communicates to them must also use ZMQ.  This project,
kernel-relay, connects to a kernel and relays ZMQ communications across socketio
sockets.  This allows web applications to use Jupyter kernels with socketio
instead of ZMQ.  kernel-relay includes a minimal RESTful API for managing kernel
life cycles.

kernel-relay was designed to be used with
[enchannel-socketio-backend](https://github.com/nteract/enchannel-socketio-backend).

## Usage
The CLI for kernel-relay is:

```bash
kernel-relay [port]
```

Kernel-relay's HTTP RESTful API listens on port 3000 by default.

### RESTful API
#### spawn kernel
The RESTful API for spawning a kernel follows:

```
/spawn/[kernelSpecName]
```

The response is a JSON string.  The success message contains the kernel's ID:

```js
{
  "id": string
}
```

If an error occurs, the response is HTTP status 500 containing a JSON string with error information:

```js
{
  "error": string
}
```

Example:

```
$ curl localhost:3000/spawn/python3
{"id":"d6f3beac-c8d3-489b-af64-b1e91dba0ad7"}
```

#### shutdown kernel
The RESTful API for shutting a kernel down follows:

```
/shutdown/[id]
```

The response is a JSON string.  The success message contains the kernel's ID:

```js
{
  "id": string
}
```

If an error occurs, the response is HTTP status 500 containing a JSON string with error information:

```js
{
  "error": string
}
```

Example:

```
$ curl localhost:3000/shutdown/d6f3beac-c8d3-489b-af64-b1e91dba0ad7
{"id":"d6f3beac-c8d3-489b-af64-b1e91dba0ad7"}
```

#### socket.io connections
Socket.io connections are available at the following endpoints by kernel ID:

```
/shell/[id]
/stdin/[id]
/iopub/[id]
/control/[id]
```

The following is an example of how to connect to the shell channel using socket.io:

```js
const io = require('socket.io-client');
const shell = io.connect('http://localhost:3000/shell/d6f3beac-c8d3-489b-af64-b1e91dba0ad7');
```

## Development
To develop against kernel-relay, first clone the repo then from within the
cloned folder run:

```bash
npm install
npm link
```

Before opening a pull request, please run the unit tests locally:

```bash
npm test
```
