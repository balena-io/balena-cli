(function() {
  var chalk, errors;

  chalk = require('chalk');

  errors = require('resin-cli-errors');

  exports.handle = function(error) {
    var message;
    message = errors.interpret(error);
    if (message == null) {
      return;
    }
    if (process.env.DEBUG) {
      message = error.stack;
    }
    console.error(chalk.red(message));
    return process.exit(error.exitCode || 1);
  };

}).call(this);
