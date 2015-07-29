(function() {
  var _, os;

  _ = require('lodash');

  os = require('os');

  exports.handle = function(error, exit) {
    var errorCode, message;
    if (exit == null) {
      exit = true;
    }
    if ((error == null) || !(error instanceof Error)) {
      return;
    }
    if (process.env.DEBUG) {
      console.error(error.stack);
    } else {
      if (error.code === 'EISDIR') {
        console.error("File is a directory: " + error.path);
      } else if (error.code === 'ENOENT') {
        console.error("No such file or directory: " + error.path);
      } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        message = 'You don\'t have enough privileges to run this operation.\n';
        if (os.platform() === 'win32') {
          message += 'Run a new Command Prompt as administrator and try running this command again.';
        } else {
          message += 'Try running this command again prefixing it with `sudo`.';
        }
        console.error(message);
      } else if (error.code === 'ENOGIT') {
        console.error('Git is not installed on this system.\nHead over to http://git-scm.com to install it and run this command again.');
      } else if (error.message != null) {
        console.error(error.message);
      }
    }
    if (_.isNumber(error.exitCode)) {
      errorCode = error.exitCode;
    } else {
      errorCode = 1;
    }
    if (exit) {
      return process.exit(errorCode);
    }
  };

}).call(this);
