(function() {
  var _;

  _ = require('lodash');

  exports.yes = {
    signature: 'yes',
    description: 'confirm non interactively',
    boolean: true,
    alias: 'y'
  };

  exports.optionalApplication = {
    signature: 'application',
    parameter: 'application',
    description: 'application name',
    alias: ['a', 'app']
  };

  exports.application = _.defaults({
    required: 'You have to specify an application'
  }, exports.optionalApplication);

  exports.network = {
    signature: 'network',
    parameter: 'network',
    description: 'network type',
    alias: 'n'
  };

  exports.wifiSsid = {
    signature: 'ssid',
    parameter: 'ssid',
    description: 'wifi ssid, if network is wifi',
    alias: 's'
  };

  exports.wifiKey = {
    signature: 'key',
    parameter: 'key',
    description: 'wifi key, if network is wifi',
    alias: 'k'
  };

}).call(this);
