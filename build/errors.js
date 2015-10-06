(function() {
  var chalk, errors, patterns;

  chalk = require('chalk');

  errors = require('resin-cli-errors');

  patterns = require('./utils/patterns');

  exports.handle = function(error) {
    var message;
    message = errors.interpret(error);
    if (message == null) {
      return;
    }
    if (process.env.DEBUG) {
      message = error.stack;
    }
    patterns.printErrorMessage(message);
    return process.exit(error.exitCode || 1);
  };

}).call(this);
