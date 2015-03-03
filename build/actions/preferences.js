(function() {
  var open, resin, url;

  open = require('open');

  url = require('url');

  resin = require('resin-sdk');

  exports.preferences = {
    signature: 'preferences',
    description: 'open preferences form',
    help: 'Use this command to open the preferences form.\n\nIn the future, we will allow changing all preferences directly from the terminal.\nFor now, we open your default web browser and point it to the web based preferences form.\n\nExamples:\n\n	$ resin preferences',
    permission: 'user',
    action: function() {
      var absUrl, preferencesUrl;
      preferencesUrl = resin.settings.get('urls.preferences');
      absUrl = url.resolve(resin.settings.get('remoteUrl'), preferencesUrl);
      return open(absUrl);
    }
  };

}).call(this);
