(function() {
  var packageJSON, updateAction, updateNotifier;

  updateNotifier = require('update-notifier');

  packageJSON = require('../package.json');

  updateAction = require('./actions/update');

  exports.perform = function(callback) {
    return updateAction.update.action(null, null, callback);
  };

  exports.notify = function(update) {
    if (!process.stdout.isTTY) {
      return;
    }
    return console.log("> Major update available: " + update.current + " -> " + update.latest + "\n> Run resin update to update.\n> Beware that a major release might introduce breaking changes.\n");
  };

  exports.check = function(callback) {
    var notifier;
    notifier = updateNotifier({
      pkg: packageJSON
    });
    if (notifier.update == null) {
      return callback();
    }
    if (notifier.update.type === 'major') {
      exports.notify(notifier.update);
      return callback();
    }
    console.log("Performing " + notifier.update.type + " update, hold tight...");
    return exports.perform(callback);
  };

}).call(this);
