(function() {
  var Promise, TOKEN_URL, _, events, form, open, resin, settings, url, validEmail, visuals;

  Promise = require('bluebird');

  open = Promise.promisify(require('open'));

  _ = require('lodash');

  url = require('url');

  resin = require('resin-sdk');

  settings = require('resin-settings-client');

  form = require('resin-cli-form');

  visuals = require('resin-cli-visuals');

  validEmail = require('valid-email');

  events = require('resin-cli-events');

  TOKEN_URL = url.resolve(settings.get('dashboardUrl'), '/preferences');

  exports.login = {
    signature: 'login [token]',
    description: 'login to resin.io',
    help: "Use this command to login to your resin.io account.\n\nTo login, you need your token, which is accesible from the preferences page:\n\n	" + TOKEN_URL + "\n\nExamples:\n\n	$ resin login\n	$ resin login \"eyJ0eXAiOiJKV1Qi...\"",
    action: function(params, options, done) {
      return Promise["try"](function() {
        if (params.token != null) {
          return params.token;
        }
        console.info("To login to the Resin CLI, you need your unique token, which is accesible from\nthe preferences page at " + TOKEN_URL + "\n\nAttempting to open a browser at that location...");
        return open(TOKEN_URL)["catch"](function() {
          return console.error("Unable to open a web browser in the current environment.\nPlease visit " + TOKEN_URL + " manually.");
        }).then(function() {
          return form.ask({
            message: 'What\'s your token? (visible in the preferences page)',
            type: 'input'
          });
        });
      }).then(resin.auth.loginWithToken).then(resin.auth.whoami).tap(function(username) {
        console.info("Successfully logged in as: " + username);
        return events.send('user.login');
      }).nodeify(done);
    }
  };

  exports.logout = {
    signature: 'logout',
    description: 'logout from resin.io',
    help: 'Use this command to logout from your resin.io account.o\n\nExamples:\n\n	$ resin logout',
    permission: 'user',
    action: function(params, options, done) {
      return resin.auth.logout().then(function() {
        return events.send('user.logout');
      }).nodeify(done);
    }
  };

  exports.signup = {
    signature: 'signup',
    description: 'signup to resin.io',
    help: 'Use this command to signup for a resin.io account.\n\nIf signup is successful, you\'ll be logged in to your new user automatically.\n\nExamples:\n\n	$ resin signup\n	Email: me@mycompany.com\n	Username: johndoe\n	Password: ***********\n\n	$ resin whoami\n	johndoe',
    action: function(params, options, done) {
      return form.run([
        {
          message: 'Email:',
          name: 'email',
          type: 'input',
          validate: function(input) {
            if (!validEmail(input)) {
              return 'Email is not valid';
            }
            return true;
          }
        }, {
          message: 'Username:',
          name: 'username',
          type: 'input'
        }, {
          message: 'Password:',
          name: 'password',
          type: 'password',
          validate: function(input) {
            if (input.length < 8) {
              return 'Password should be 8 characters long';
            }
            return true;
          }
        }
      ]).then(resin.auth.register).then(resin.auth.loginWithToken).tap(function() {
        return events.send('user.signup');
      }).nodeify(done);
    }
  };

  exports.whoami = {
    signature: 'whoami',
    description: 'get current username and email address',
    help: 'Use this command to find out the current logged in username and email address.\n\nExamples:\n\n	$ resin whoami',
    permission: 'user',
    action: function(params, options, done) {
      return Promise.props({
        username: resin.auth.whoami(),
        email: resin.auth.getEmail()
      }).then(function(results) {
        return console.log(visuals.table.vertical(results, ['$account information$', 'username', 'email']));
      }).nodeify(done);
    }
  };

}).call(this);
