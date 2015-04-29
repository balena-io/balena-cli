(function() {
  var _, async, resin;

  _ = require('lodash');

  async = require('async');

  resin = require('resin-sdk');

  exports.set = {
    signature: 'note <|note>',
    description: 'set a device note',
    help: 'Use this command to set or update a device note.\n\nIf note command isn\'t passed, the tool attempts to read from `stdin`.\n\nTo view the notes, use $ resin device <name>.\n\nExamples:\n\n	$ resin note "My useful note" --device MyDevice\n	$ cat note.txt | resin note --device MyDevice',
    options: [
      {
        signature: 'device',
        parameter: 'device',
        description: 'device name',
        alias: ['d', 'dev'],
        required: 'You have to specify a device'
      }
    ],
    permission: 'user',
    action: function(params, options, done) {
      if (_.isEmpty(params.note)) {
        return done(new Error('Missing note content'));
      }
      return resin.models.device.note(options.device, params.note, done);
    }
  };

}).call(this);
