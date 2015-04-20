(function() {
  var _, async, examplesData, fs, mkdirp, path, resin, vcs, visuals;

  mkdirp = require('mkdirp');

  async = require('async');

  fs = require('fs');

  path = require('path');

  _ = require('lodash');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  vcs = require('resin-vcs');

  examplesData = require('../data/examples.json');

  exports.list = {
    signature: 'examples',
    description: 'list all example applications',
    help: 'Use this command to list available example applications from resin.io\n\nExample:\n\n	$ resin examples',
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
    help: 'Use this command to show information of a single example application\n\nExample:\n\n	$ resin example 3',
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
    help: 'Use this command to clone an example application to the current directory\n\nThis command outputs information about the cloning process.\nUse `--quiet` to remove that output.\n\nExample:\n\n	$ resin example clone 3',
    permission: 'user',
    action: function(params, options, done) {
      var currentDirectory, destination, example;
      example = examplesData[params.id - 1];
      if (example == null) {
        return done(new Error("Unknown example: " + id));
      }
      currentDirectory = process.cwd();
      destination = path.join(currentDirectory, example.name);
      return mkdirp(destination, function(error) {
        if (error != null) {
          return done(error);
        }
        console.info("Cloning " + example.display_name + " to " + destination);
        vcs.clone(example.repository, destination, done);
        return done();
      });
    }
  };

}).call(this);
