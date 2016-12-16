(function() {
  var getSdk, opts, settings;

  getSdk = require('resin-sdk');

  settings = require('resin-settings-client');

  opts = {
    apiUrl: settings.get('apiUrl'),
    imageMakerUrl: settings.get('imageMakerUrl'),
    dataDirectory: settings.get('dataDirectory'),
    apiVersion: 'v2',
    retries: 2
  };

  module.exports = getSdk(opts);

}).call(this);
