(function() {
  var Promise, form;

  Promise = require('bluebird');

  form = require('resin-cli-form');

  exports.selectDeviceType = function() {
    return form.ask({
      message: 'Device Type',
      type: 'list',
      choices: ['Raspberry Pi', 'Raspberry Pi 2', 'BeagleBone Black']
    });
  };

  exports.confirm = function(yesOption, message) {
    return Promise["try"](function() {
      if (yesOption) {
        return true;
      }
      return form.ask({
        message: message,
        type: 'confirm',
        "default": false
      });
    }).then(function(confirmed) {
      if (!confirmed) {
        throw new Error('Aborted');
      }
    });
  };

}).call(this);
