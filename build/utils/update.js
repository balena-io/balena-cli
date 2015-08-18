(function() {
  var notifier, packageJSON, updateNotifier;

  updateNotifier = require('update-notifier');

  packageJSON = require('../../package.json');

  notifier = updateNotifier({
    pkg: packageJSON
  });

  exports.hasAvailableUpdate = function() {
    return notifier != null;
  };

  exports.notify = function() {
    if (!exports.hasAvailableUpdate()) {
      return;
    }
    return notifier.notify();
  };

}).call(this);
