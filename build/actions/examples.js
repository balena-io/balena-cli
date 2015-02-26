(function() {
  var _, async, examplesData, fs, gitCli, path, resin, visuals;

  async = require('async');

  fs = require('fs');

  path = require('path');

  _ = require('lodash');

  gitCli = require('git-cli');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  examplesData = require('../data/examples.json');

  exports.list = {
    signature: 'examples',
    description: 'list all example applications',
    help: 'Use this command to list available example applications from resin.io\n\nExample:\n	$ resin examples',
    permission: 'user',
    action: function() {
      examplesData = _.map(examplesData, function(example, index) {
        example.id = index + 1;
        return example;
      });
      examplesData = _.map(examplesData, function(example) {
        if (example.author == null) {
          example.author = 'Unknown';
        }
        return example;
      });
      return console.log(visuals.widgets.table.horizontal(examplesData, ['id', 'display_name', 'repository', 'author']));
    }
  };

  exports.info = {
    signature: 'example <id>',
    description: 'list a single example application',
    help: 'Use this command to show information of a single example application\n\nExample:\n	$ resin example 3',
    permission: 'user',
    action: function(params, options, done) {
      var example, id;
      id = params.id - 1;
      example = examplesData[id];
      if (example == null) {
        return done(new Error("Unknown example: " + id));
      }
      example.id = id;
      if (example.author == null) {
        example.author = 'Unknown';
      }
      console.log(visuals.widgets.table.vertical(example, ['id', 'display_name', 'description', 'author', 'repository']));
      return done();
    }
  };

  exports.clone = {
    signature: 'example clone <id>',
    description: 'clone an example application',
    help: 'Use this command to clone an example application to the current directory\n\nThis command outputs information about the cloning process.\nUse `--quiet` to remove that output.\n\nExample:\n	$ resin example clone 3',
    permission: 'user',
    action: function(params, options, done) {
      var example;
      example = examplesData[params.id - 1];
      if (example == null) {
        return done(new Error("Unknown example: " + id));
      }
      return async.waterfall([
        function(callback) {
          var exampleAbsolutePath;
          exampleAbsolutePath = path.join(process.cwd(), example.name);
          return fs.exists(exampleAbsolutePath, function(exists) {
            var error;
            if (!exists) {
              return callback();
            }
            error = new Error("Directory exists: " + example.name);
            return callback(error);
          });
        }, function(callback) {
          console.info("Cloning " + example.display_name + " to " + example.name);
          return gitCli.Repository.clone(example.repository, example.name, callback);
        }
      ], done);
    }
  };

}).call(this);
