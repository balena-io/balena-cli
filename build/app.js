(function() {
  var _, actions, async, capitano, errors, plugins, resin;

  _ = require('lodash');

  async = require('async');

  capitano = require('capitano');

  resin = require('resin-sdk');

  actions = require('./actions');

  errors = require('./errors');

  plugins = require('./plugins');

  capitano.permission('user', function(done) {
    return resin.auth.isLoggedIn().then(function(isLoggedIn) {
      if (!isLoggedIn) {
        throw new Error('You have to log in');
      }
    }).nodeify(done);
  });

  capitano.command({
    signature: '*',
    action: function() {
      return capitano.execute({
        command: 'help'
      });
    }
  });

  capitano.command(actions.info.version);

  capitano.command(actions.help.help);

  capitano.command(actions.wizard.wizard);

  capitano.command(actions.auth.login);

  capitano.command(actions.auth.logout);

  capitano.command(actions.auth.signup);

  capitano.command(actions.auth.whoami);

  capitano.command(actions.app.create);

  capitano.command(actions.app.list);

  capitano.command(actions.app.remove);

  capitano.command(actions.app.restart);

  capitano.command(actions.app.associate);

  capitano.command(actions.app.info);

  capitano.command(actions.device.list);

  capitano.command(actions.device.supported);

  capitano.command(actions.device.rename);

  capitano.command(actions.device.init);

  capitano.command(actions.device.await);

  capitano.command(actions.device.info);

  capitano.command(actions.device.remove);

  capitano.command(actions.device.identify);

  capitano.command(actions.notes.set);

  capitano.command(actions.preferences.preferences);

  capitano.command(actions.keys.list);

  capitano.command(actions.keys.add);

  capitano.command(actions.keys.info);

  capitano.command(actions.keys.remove);

  capitano.command(actions.env.list);

  capitano.command(actions.env.add);

  capitano.command(actions.env.rename);

  capitano.command(actions.env.remove);

  capitano.command(actions.logs);

  capitano.command(actions.plugin.list);

  capitano.command(actions.plugin.install);

  capitano.command(actions.plugin.update);

  capitano.command(actions.plugin.remove);

  async.waterfall([
    function(callback) {
      return plugins.register('resin-plugin-', callback);
    }, function(callback) {
      var cli;
      cli = capitano.parse(process.argv);
      return capitano.execute(cli, callback);
    }
  ], errors.handle);

}).call(this);
