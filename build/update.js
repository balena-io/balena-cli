(function() {
  var _, packageJSON, updateNotifier;

  updateNotifier = require('update-notifier');

  _ = require('lodash');

  _.str = require('underscore.string');

  packageJSON = require('../package.json');

  exports.notify = function(update) {
    if (!process.stdout.isTTY) {
      return;
    }
    return console.log("> " + (_.str.capitalize(update.type)) + " update available: " + update.current + " -> " + update.latest + "\n> Run:\n>		$ resin update");
  };

  exports.check = function(callback) {
    var notifier;
    notifier = updateNotifier({
      pkg: packageJSON
    });
    if (notifier.update != null) {
      exports.notify(notifier.update);
    }
    return callback();
  };

}).call(this);
