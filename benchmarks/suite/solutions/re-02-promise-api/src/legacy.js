const fs = require('node:fs');

/** Reads a JSON configuration file: Promise when called without a callback. */
function readConfig(path, callback) {
  const promise = fs.promises.readFile(path, 'utf8').then((text) => JSON.parse(text));
  if (!callback) return promise;
  promise.then((config) => callback(null, config), (error) => callback(error));
  return undefined;
}

module.exports = { readConfig };
