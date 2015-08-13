(function() {
  var _, async, capitano, commandOptions, form, fs, resin, visuals;

  _ = require('lodash');

  _.str = require('underscore.string');

  async = require('async');

  fs = require('fs');

  resin = require('resin-sdk');

  capitano = require('capitano');

  visuals = require('resin-cli-visuals');

  commandOptions = require('./command-options');

  form = require('resin-cli-form');

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
        return console.log(visuals.table.vertical(key, ['id', 'title', 'public_key']));
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
      return async.waterfall([
        function(callback) {
          if (options.yes) {
            return callback(null, true);
          } else {
            return form.ask({
              message: 'Are you sure you want to delete the key?',
              type: 'confirm',
              "default": false
            }).nodeify(callback);
          }
        }, function(confirmed, callback) {
          if (!confirmed) {
            return callback();
          }
          return resin.models.key.remove(params.id).nodeify(callback);
        }
      ], done);
    }
  };

  exports.add = {
    signature: 'key add <name> [path]',
    description: 'add a SSH key to resin.io',
    help: 'Use this command to associate a new SSH key with your account.\n\nIf `path` is omitted, the command will attempt\nto read the SSH key from stdin.\n\nExamples:\n\n	$ resin key add Main ~/.ssh/id_rsa.pub\n	$ cat ~/.ssh/id_rsa.pub | resin key add Main',
    permission: 'user',
    action: function(params, options, done) {
      return async.waterfall([
        function(callback) {
          if (params.path != null) {
            return fs.readFile(params.path, {
              encoding: 'utf8'
            }, callback);
          } else {
            return capitano.utils.getStdin(function(data) {
              return callback(null, data);
            });
          }
        }, function(key, callback) {
          return resin.models.key.create(params.name, key).nodeify(callback);
        }
      ], done);
    }
  };

}).call(this);
