(function() {
  var Promise, _, capitano, commandOptions, events, fs, patterns, resin, visuals;

  Promise = require('bluebird');

  fs = Promise.promisifyAll(require('fs'));

  _ = require('lodash');

  resin = require('resin-sdk');

  capitano = require('capitano');

  visuals = require('resin-cli-visuals');

  events = require('resin-cli-events');

  commandOptions = require('./command-options');

  patterns = require('../utils/patterns');

  exports.list = {
    signature: 'keys',
    description: 'list all ssh keys',
    help: 'Use this command to list all your SSH keys.\n\nExamples:\n\n	$ resin keys',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.key.getAll().then(function(keys) {
        return console.log(visuals.table.horizontal(keys, ['id', 'title']));
      }).nodeify(done);
    }
  };

  exports.info = {
    signature: 'key <id>',
    description: 'list a single ssh key',
    help: 'Use this command to show information about a single SSH key.\n\nExamples:\n\n	$ resin key 17',
    permission: 'user',
    action: function(params, options, done) {
      return resin.models.key.get(params.id).then(function(key) {
        console.log(visuals.table.vertical(key, ['id', 'title']));
        return console.log('\n' + key.public_key);
      }).nodeify(done);
    }
  };

  exports.remove = {
    signature: 'key rm <id>',
    description: 'remove a ssh key',
    help: 'Use this command to remove a SSH key from resin.io.\n\nNotice this command asks for confirmation interactively.\nYou can avoid this by passing the `--yes` boolean option.\n\nExamples:\n\n	$ resin key rm 17\n	$ resin key rm 17 --yes',
    options: [commandOptions.yes],
    permission: 'user',
    action: function(params, options, done) {
      return patterns.confirm(options.yes, 'Are you sure you want to delete the key?').then(function() {
        return resin.models.key.remove(params.id);
      }).tap(function() {
        return events.send('publicKey.delete', {
          id: params.id
        });
      }).nodeify(done);
    }
  };

  exports.add = {
    signature: 'key add <name> [path]',
    description: 'add a SSH key to resin.io',
    help: 'Use this command to associate a new SSH key with your account.\n\nIf `path` is omitted, the command will attempt\nto read the SSH key from stdin.\n\nExamples:\n\n	$ resin key add Main ~/.ssh/id_rsa.pub\n	$ cat ~/.ssh/id_rsa.pub | resin key add Main',
    permission: 'user',
    action: function(params, options, done) {
      return Promise["try"](function() {
        if (params.path != null) {
          return fs.readFileAsync(params.path, {
            encoding: 'utf8'
          });
        }
        return Promise.fromNode(function(callback) {
          return capitano.utils.getStdin(function(data) {
            return callback(null, data);
          });
        });
      }).then(_.partial(resin.models.key.create, params.name)).tap(function() {
        return events.send('publicKey.create');
      }).nodeify(done);
    }
  };

}).call(this);
