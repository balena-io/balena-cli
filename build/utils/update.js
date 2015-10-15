(function() {
  var isRoot, notifier, packageJSON, updateNotifier;

  updateNotifier = require('update-notifier');

  isRoot = require('is-root');

  packageJSON = require('../../package.json');

  if (!isRoot()) {
    notifier = updateNotifier({
      pkg: packageJSON
    });
  }

  exports.hasAvailableUpdate = function() {
    return notifier != null;
  };

  exports.notify = function() {
    if (!exports.hasAvailableUpdate()) {
      return;
    }
    notifier.notify();
    return console.log('Notice that you might need administrator privileges depending on your setup');
  };

}).call(this);
