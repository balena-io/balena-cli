(function() {
  var Promise, _, auth, events, form, resin, validation, visuals;

  Promise = require('bluebird');

  _ = require('lodash');

  resin = require('resin-sdk');

  form = require('resin-cli-form');

  visuals = require('resin-cli-visuals');

  events = require('resin-cli-events');

  auth = require('resin-cli-auth');

  validation = require('../utils/validation');

  exports.login = {
    signature: 'login',
    description: 'login to resin.io',
    help: 'Use this command to login to your resin.io account.\n\nExamples:\n\n	$ resin login',
    primary: true,
    action: function(params, options, done) {
      console.info('Connecting to the web dashboard');
      return auth.login().then(resin.auth.whoami).tap(function(username) {
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
          validate: validation.validateEmail
        }, {
          message: 'Username:',
          name: 'username',
          type: 'input'
        }, {
          message: 'Password:',
          name: 'password',
          type: 'password',
          validate: validation.validatePassword
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
        email: resin.auth.getEmail(),
        url: resin.settings.get('resinUrl')
      }).then(function(results) {
        return console.log(visuals.table.vertical(results, ['$account information$', 'username', 'email', 'url']));
      }).nodeify(done);
    }
  };

}).call(this);
