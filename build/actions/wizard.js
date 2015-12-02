(function() {
  var Promise, capitano, patterns, resin;

  Promise = require('bluebird');

  capitano = Promise.promisifyAll(require('capitano'));

  resin = require('resin-sdk');

  patterns = require('../utils/patterns');

  exports.wizard = {
    signature: 'quickstart [name]',
    description: 'getting started with resin.io',
    help: 'Use this command to run a friendly wizard to get started with resin.io.\n\nThe wizard will guide you through:\n\n	- Create an application.\n	- Initialise an SDCard with the resin.io operating system.\n	- Associate an existing project directory with your resin.io application.\n	- Push your project to your devices.\n\nExamples:\n\n	$ sudo resin quickstart\n	$ sudo resin quickstart MyApp',
    permission: 'user',
    primary: true,
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
      }).then(function() {
        return resin.models.application.get(params.name);
      }).then(function(application) {
        return console.log("Your device is ready to start pushing some code!\n\nCheck our official documentation for more information:\n\n    http://docs.resin.io/#/pages/introduction/introduction.md\n\nClone an example or go to an existing application directory and run:\n\n    $ git remote add resin " + application.git_repository + "\n    $ git push resin master");
      }).nodeify(done);
    }
  };

}).call(this);
