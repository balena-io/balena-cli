(function() {
  var LOGS_HISTORY_COUNT, _, resin;

  _ = require('lodash');

  resin = require('resin-sdk');

  LOGS_HISTORY_COUNT = 200;

  exports.logs = {
    signature: 'logs <uuid>',
    description: 'show device logs',
    help: 'Use this command to show logs for a specific device.\n\nBy default, the command prints all log messages and exit.\n\nTo limit the output to the n last lines, use the `--num` option along with a number.\nThis is similar to doing `resin logs <uuid> | tail -n X`.\n\nTo continuously stream output, and see new logs in real time, use the `--tail` option.\n\nNote that for now you need to provide the whole UUID for this command to work correctly,\nand the tool won\'t notice if you\'re using an invalid UUID.\n\nThis is due to some technical limitations that we plan to address soon.\n\nExamples:\n	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828\n	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --num 20\n	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --tail',
    options: [
      {
        signature: 'num',
        parameter: 'num',
        description: 'number of lines to display',
        alias: 'n'
      }, {
        signature: 'tail',
        description: 'continuously stream output',
        boolean: true,
        alias: 't'
      }
    ],
    permission: 'user',
    action: function(params, options, done) {
      return resin.logs.subscribe(params.uuid, {
        history: options.num || LOGS_HISTORY_COUNT,
        tail: options.tail
      }, function(error, message) {
        if (error != null) {
          return done(error);
        }
        if (_.isArray(message)) {
          _.each(message, function(line) {
            return console.log(line);
          });
        } else {
          console.log(message);
        }
        return done();
      });
    }
  };

}).call(this);
