(function() {
  module.exports = {
    signature: 'logs <uuid>',
    description: 'show device logs',
    help: 'Use this command to show logs for a specific device.\n\nBy default, the command prints all log messages and exit.\n\nTo continuously stream output, and see new logs in real time, use the `--tail` option.\n\nNote that for now you need to provide the whole UUID for this command to work correctly.\n\nThis is due to some technical limitations that we plan to address soon.\n\nExamples:\n\n	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828\n	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --tail',
    options: [
      {
        signature: 'tail',
        description: 'continuously stream output',
        boolean: true,
        alias: 't'
      }
    ],
    permission: 'user',
    primary: true,
    action: function(params, options, done) {
      var _, moment, printLine, promise, resin;
      _ = require('lodash');
      resin = require('resin-sdk');
      moment = require('moment');
      printLine = function(line) {
        var timestamp;
        timestamp = moment(line.timestamp).format('DD.MM.YY HH:mm:ss (ZZ)');
        return console.log(timestamp + " " + line.message);
      };
      promise = resin.logs.history(params.uuid).each(printLine);
      if (!options.tail) {
        return promise["catch"](done)["finally"](function() {
          return process.exit(0);
        });
      }
      return promise.then(function() {
        return resin.logs.subscribe(params.uuid).then(function(logs) {
          logs.on('line', printLine);
          return logs.on('error', done);
        });
      })["catch"](done);
    }
  };

}).call(this);
