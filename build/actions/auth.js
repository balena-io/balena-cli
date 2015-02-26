(function() {
  var _, async, resin, url, visuals;

  _ = require('lodash-contrib');

  url = require('url');

  async = require('async');

  resin = require('resin-sdk');

  visuals = require('resin-cli-visuals');

  exports.login = {
    signature: 'login',
    description: 'login to resin.io',
    help: 'Use this command to login to your resin.io account.\nYou need to login before you can use most of the commands this tool provides.\n\nYou can pass your credentials as `--username` and `--password` options, or you can omit the\ncredentials, in which case the tool will present you with an interactive login form.\n\nExamples:\n	$ resin login --username <username> --password <password>\n	$ resin login',
    options: [
      {
        signature: 'username',
        parameter: 'username',
        description: 'user name',
        alias: 'u'
      }, {
        signature: 'password',
        parameter: 'password',
        description: 'user password',
        alias: 'p'
      }
    ],
    action: function(params, options, done) {
      var hasOptionCredentials;
      hasOptionCredentials = !_.isEmpty(options);
      if (hasOptionCredentials) {
        if (!options.username) {
          return done(new Error('Missing username'));
        }
        if (!options.password) {
          return done(new Error('Missing password'));
        }
      }
      return async.waterfall([
        function(callback) {
          if (hasOptionCredentials) {
            return callback(null, options);
          } else {
            return visuals.widgets.login(callback);
          }
        }, function(credentials, callback) {
          return resin.auth.login(credentials, callback);
        }
      ], done);
    }
  };

  exports.logout = {
    signature: 'logout',
    description: 'logout from resin.io',
    help: 'Use this command to logout from your resin.io account.o\n\nExamples:\n	$ resin logout',
    permission: 'user',
    action: function(params, options, done) {
      return resin.auth.logout(done);
    }
  };

  exports.signup = {
    signature: 'signup',
    description: 'signup to resin.io',
    help: 'Use this command to signup for a resin.io account.\n\nIf signup is successful, you\'ll be logged in to your new user automatically.\n\nExamples:\n	$ resin signup\n	Email: me@mycompany.com\n	Username: johndoe\n	Password: ***********\n\n	$ resin signup --email me@mycompany.com --username johndoe --password ***********\n\n	$ resin whoami\n	johndoe',
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
          return visuals.widgets.register(callback);
        }, function(credentials, callback) {
          return resin.auth.register(credentials, function(error, token) {
            return callback(error, credentials);
          });
        }, function(credentials, callback) {
          return resin.auth.login(credentials, callback);
        }
      ], done);
    }
  };

  exports.whoami = {
    signature: 'whoami',
    description: 'get current username',
    help: 'Use this command to find out the current logged in username.\n\nExamples:\n	$ resin whoami',
    permission: 'user',
    action: function(params, options, done) {
      return resin.auth.whoami(function(error, username) {
        if (username == null) {
          return done(new Error('Username not found'));
        }
        return console.log(username);
      });
    }
  };

}).call(this);
