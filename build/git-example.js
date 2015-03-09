(function() {
  var git;

  git = require('./git');

  git.execute('status', process.cwd(), function(error, stdout, stderr) {
    console.log(arguments);
    return console.log(stdout);
  });

}).call(this);
