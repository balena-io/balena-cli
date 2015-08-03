(function() {
  var TOKEN_URL, _, async, form, open, resin, settings, url, visuals;

  open = require('open');

  _ = require('lodash-contrib');

  url = require('url');

  async = require('async');

  resin = require('resin-sdk');

  settings = require('resin-settings-client');

  form = require('resin-cli-form');

  visuals = require('resin-cli-visuals');

  TOKEN_URL = url.resolve(settings.get('dashboardUrl'), '/preferences');

  exports.login = {
    signature: 'login [token]',
    description: 'login to resin.io',
    help: "Use this command to login to your resin.io account.\n\nTo login, you need your token, which is accesible from the preferences page:\n\n	" + TOKEN_URL + "\n\nExamples:\n\n	$ resin login\n	$ resin login \"eyJ0eXAiOiJKV1Qi...\"",
    action: function(params, options, done) {
      return async.waterfall([
        function(callback) {
          if (params.token != null) {
            return callback(null, params.token);
          }
          console.info("To login to the Resin CLI, you need your unique token, which is accesible from\nthe preferences page at " + TOKEN_URL + "\n\nAttempting to open a browser at that location...");
          return open(TOKEN_URL, function(error) {
            if (error != null) {
              console.error("Unable to open a web browser in the current environment.\nPlease visit " + TOKEN_URL + " manually.");
            }
            return form.ask({
              message: 'What\'s your token? (visible in the preferences page)',
              type: 'input'
            }).nodeify(callback);
          });
        }, function(token, callback) {
          return resin.auth.loginWithToken(token).nodeify(callback);
        }, function(callback) {
          return resin.auth.whoami().nodeify(callback);
        }, function(username, callback) {
          console.info("Successfully logged in as: " + username);
          return callback();
        }
      ], done);
    }
  };

  exports.logout = {
    signature: 'logout',
    description: 'logout from resin.io',
    help: 'Use this command to logout from your resin.io account.o\n\nExamples:\n\n	$ resin logout',
    permission: 'user',
    action: function(params, options, done) {
      return resin.auth.logout().nodeify(done);
    }
  };

  exports.signup = {
    signature: 'signup',
    description: 'signup to resin.io',
    help: 'Use this command to signup for a resin.io account.\n\nIf signup is successful, you\'ll be logged in to your new user automatically.\n\nExamples:\n\n	$ resin signup\n	Email: me@mycompany.com\n	Username: johndoe\n	Password: ***********\n\n	$ resin signup --email me@mycompany.com --username johndoe --password ***********\n\n	$ resin whoami\n	johndoe',
    options: [
      {
        signature: 'email',
        parameter: 'email',
        description: 'user email',
        alias: 'e'
      }, {
        signature: 'username',
        parameter: 'username',
        description: 'user name',
        alias: 'u'
      }, {
        signature: 'password',
        parameter: 'user password',
        description: 'user password',
        alias: 'p'
      }
    ],
    action: function(params, options, done) {
      var hasOptionCredentials;
      hasOptionCredentials = !_.isEmpty(options);
      if (hasOptionCredentials) {
        if (options.email == null) {
          return done(new Error('Missing email'));
        }
        if (options.username == null) {
          return done(new Error('Missing username'));
        }
        if (options.password == null) {
          return done(new Error('Missing password'));
        }
      }
      return async.waterfall([
        function(callback) {
          if (hasOptionCredentials) {
            return callback(null, options);
          }
          return form.run([
            {
              message: 'Email:',
              name: 'email',
              type: 'input'
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
          ]).nodeify(callback);
        }, function(credentials, callback) {
          return resin.auth.register(credentials)["return"](credentials).nodeify(callback);
        }, function(credentials, callback) {
          return resin.auth.login(credentials).nodeify(callback);
        }
      ], done);
    }
  };

  exports.whoami = {
    signature: 'whoami',
    description: 'get current username',
    help: 'Use this command to find out the current logged in username.\n\nExamples:\n\n	$ resin whoami',
    permission: 'user',
    action: function(params, options, done) {
      return resin.auth.whoami().then(function(username) {
        if (username == null) {
          throw new Error('Username not found');
        }
        return resin.auth.getEmail().then(function(email) {
          return console.log(visuals.table.vertical({
            username: username,
            email: email
          }, ['$account information$', 'username', 'email']));
        });
      }).nodeify(done);
    }
  };

}).call(this);
