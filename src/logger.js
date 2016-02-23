const chalk = require('chalk');

const USER_ICON = "👤";
const KERNEL_ICON = "💻";
const STOP_ICON = "❌";

function formatConnection(userConnection) {
  return `${userConnection.remoteAddress}:${userConnection.remotePort}`;
}

exports.userConnected = function userConnected(userConnection, channel, kernel) {
  console.log('  ' + chalk.bgCyan.bold(USER_ICON + ' USER') + ' ' + formatConnection(userConnection) + ' to ' + channel + ' of ' + kernel.slice(0, 6));
}

exports.userDisconnected = function userDisconnected(userConnection, channel, kernel) {
  console.log('  ' + chalk.bgCyan.bold(chalk.red(STOP_ICON) + ' USER') + ' ' + formatConnection(userConnection) + ' from ' + channel + ' of ' + kernel.slice(0, 6));
}

exports.kernelStarted = function kernelStarted(kernel, kernelName) {
  console.log(chalk.bgBlue.bold(KERNEL_ICON + ' KERNEL') + ' ' + kernel.slice(0, 6) + ' of type ' + kernelName);
}

exports.kernelStopped = function kernelStopped(kernel) {
  console.log(chalk.bgBlue.bold(chalk.red(STOP_ICON) + ' KERNEL') + ' ' + kernel.slice(0, 6));
}

exports.startServer = function startServer(port) {
  console.log('Kernel relay listening on ' + chalk.yellow(port));
}
