
/*
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

(function() {
  exports.login = {
    signature: 'login',
    description: 'login to resin.io',
    help: 'Use this command to login to your resin.io account.\n\nThis command will prompt you to login using the following login types:\n\n- Web authorization: open your web browser and prompt you to authorize the CLI\nfrom the dashboard.\n\n- Credentials: using email/password and 2FA.\n\n- Token: using the authentication token from the preferences page.\n\nExamples:\n\n	$ resin login\n	$ resin login --web\n	$ resin login --token "..."\n	$ resin login --credentials\n	$ resin login --credentials --email johndoe@gmail.com --password secret',
    options: [
      {
        signature: 'token',
        description: 'auth token',
        parameter: 'token',
        alias: 't'
      }, {
        signature: 'web',
        description: 'web-based login',
        boolean: true,
        alias: 'w'
      }, {
        signature: 'credentials',
        description: 'credential-based login',
        boolean: true,
        alias: 'c'
      }, {
        signature: 'email',
        parameter: 'email',
        description: 'email',
        alias: ['e', 'u']
      }, {
        signature: 'password',
        parameter: 'password',
        description: 'password',
        alias: 'p'
      }
    ],
    primary: true,
    action: function(params, options, done) {
      var Promise, _, auth, events, form, login, messages, patterns, resin;
      _ = require('lodash');
      Promise = require('bluebird');
      resin = require('resin-sdk');
      events = require('resin-cli-events');
      auth = require('resin-cli-auth');
      form = require('resin-cli-form');
      patterns = require('../utils/patterns');
      messages = require('../utils/messages');
      login = function(options) {
        if (options.token != null) {
          return Promise["try"](function() {
            if (_.isString(options.token)) {
              return options.token;
            }
            return form.ask({
              message: 'Token (from the preferences page)',
              name: 'token',
              type: 'input'
            });
          }).then(resin.auth.loginWithToken);
        } else if (options.credentials) {
          return patterns.authenticate(options);
        } else if (options.web) {
          console.info('Connecting to the web dashboard');
          return auth.login();
        }
        return patterns.askLoginType().then(function(loginType) {
          options[loginType] = true;
          return login(options);
        });
      };
      return resin.settings.get('resinUrl').then(function(resinUrl) {
        console.log(messages.resinAsciiArt);
        console.log("\nLogging in to " + resinUrl);
        return login(options);
      }).then(resin.auth.whoami).tap(function(username) {
        events.send('user.login');
        console.info("Successfully logged in as: " + username);
        return console.info("\nNow what?\n\n" + messages.gettingStarted + "\n\nFind out about more super powers by running:\n\n  $ resin help\n\n" + messages.reachingOut);
      }).nodeify(done);
    }
  };

  exports.logout = {
    signature: 'logout',
    description: 'logout from resin.io',
    help: 'Use this command to logout from your resin.io account.o\n\nExamples:\n\n	$ resin logout',
    permission: 'user',
    action: function(params, options, done) {
      var events, resin;
      resin = require('resin-sdk');
      events = require('resin-cli-events');
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
      var events, form, resin, validation;
      resin = require('resin-sdk');
      form = require('resin-cli-form');
      events = require('resin-cli-events');
      validation = require('../utils/validation');
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
      var Promise, resin, visuals;
      Promise = require('bluebird');
      resin = require('resin-sdk');
      visuals = require('resin-cli-visuals');
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
