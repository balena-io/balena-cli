(function() {
  var _, resin;

  _ = require('lodash');

  resin = require('resin-sdk');

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
    action: function(params, options, done) {
      var promise;
      promise = resin.logs.history(params.uuid).each(function(line) {
        return console.log(line.message);
      });
      if (!options.tail) {
        return promise.nodeify(done);
      }
      return promise.then(function() {
        return resin.logs.subscribe(params.uuid).then(function(logs) {
          logs.on('line', function(line) {
            return console.log(line.message);
          });
          return logs.on('error', done);
        });
      })["catch"](done);
    }
  };

}).call(this);
