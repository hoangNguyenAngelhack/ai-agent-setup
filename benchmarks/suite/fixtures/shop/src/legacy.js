const fs = require('node:fs');

/** Reads a JSON configuration file. */
function readConfig(path, callback) {
  fs.readFile(path, 'utf8', (error, text) => {
    if (error) return callback(error);
    let config;
    try {
      config = JSON.parse(text);
    } catch (parseError) {
      return callback(parseError);
    }
    return callback(null, config);
  });
}

module.exports = { readConfig };
