(function() {
  var Promise, capitano, form, mkdirp, patterns, resin;

  Promise = require('bluebird');

  capitano = Promise.promisifyAll(require('capitano'));

  mkdirp = Promise.promisify(require('mkdirp'));

  resin = require('resin-sdk');

  form = require('resin-cli-form');

  patterns = require('../utils/patterns');

  exports.wizard = {
    signature: 'quickstart [name]',
    description: 'getting started with resin.io',
    help: 'Use this command to run a friendly wizard to get started with resin.io.\n\nThe wizard will guide you through:\n\n	- Create an application.\n	- Initialise an SDCard with the resin.io operating system.\n	- Associate an existing project directory with your resin.io application.\n	- Push your project to your devices.\n\nExamples:\n\n	$ sudo resin quickstart\n	$ sudo resin quickstart MyApp',
    permission: 'user',
    action: function(params, options, done) {
      return Promise["try"](function() {
        if (params.name != null) {
          return;
        }
        return patterns.selectOrCreateApplication().tap(function(applicationName) {
          return resin.models.application.has(applicationName).then(function(hasApplication) {
            if (hasApplication) {
              return applicationName;
            }
            return capitano.runAsync("app create " + applicationName);
          });
        }).then(function(applicationName) {
          return params.name = applicationName;
        });
      }).then(function() {
        return capitano.runAsync("device init --application " + params.name);
      }).tap(patterns.awaitDevice).then(function(uuid) {
        return capitano.runAsync("device " + uuid);
      }).tap(function() {
        return console.log('Your device is ready, lets start pushing some code!');
      }).then(patterns.selectProjectDirectory).tap(mkdirp).tap(process.chdir).then(function() {
        return capitano.runAsync("app associate " + params.name);
      }).then(function(remoteUrl) {
        console.log("Resin git remote added: " + remoteUrl);
        return console.log("Please type:\n\n	$ cd " + (process.cwd()) + " && git push resin master\n\nTo push your project to resin.io.");
      }).nodeify(done);
    }
  };

}).call(this);
