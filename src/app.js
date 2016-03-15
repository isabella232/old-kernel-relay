#!/usr/bin/env node
const listen = require('./index').listen;

if (process.argv.length > 2) {
  listen(parseInt(process.argv[2]));
} else {
  listen(3000);
}
