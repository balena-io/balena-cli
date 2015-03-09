(function() {
  var child_process;

  child_process = require('child_process');

  exports.isGitDirectory = function(directory, callback) {
    return exports.execute('status', directory, function(error, stdout, stderr) {
      return callback(null, error == null);
    });
  };

  exports.execute = function(command, cwd, callback) {
    return child_process.exec("git " + command, {
      cwd: cwd
    }, callback);
  };

}).call(this);
