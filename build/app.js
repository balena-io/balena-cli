(function() {
  var _, actions, async, capitano, changeProjectDirectory, errors, plugins, resin, update;

  _ = require('lodash');

  async = require('async');

  capitano = require('capitano');

  resin = require('resin-sdk');

  actions = require('./actions');

  errors = require('./errors');

  plugins = require('./plugins');

  update = require('./update');

  capitano.permission('user', function(done) {
    return resin.auth.isLoggedIn(function(isLoggedIn) {
      if (!isLoggedIn) {
        return done(new Error('You have to log in'));
      }
      return done();
    });
  });

  capitano.command({
    signature: '*',
    action: function() {
      return capitano.execute({
        command: 'help'
      });
    }
  });

  capitano.globalOption({
    signature: 'quiet',
    description: 'quiet (no output)',
    boolean: true,
    alias: 'q'
  });

  capitano.globalOption({
    signature: 'project',
    parameter: 'path',
    description: 'project path',
    alias: 'j'
  });

  capitano.globalOption({
    signature: 'no-color',
    description: 'disable colour highlighting',
    boolean: true
  });

  capitano.command(actions.info.version);

  capitano.command(actions.help.help);

  capitano.command(actions.auth.login);

  capitano.command(actions.auth.logout);

  capitano.command(actions.auth.signup);

  capitano.command(actions.auth.whoami);

  capitano.command(actions.app.create);

  capitano.command(actions.app.list);

  capitano.command(actions.app.info);

  capitano.command(actions.app.remove);

  capitano.command(actions.app.restart);

  capitano.command(actions.app.associate);

  capitano.command(actions.app.init);

  capitano.command(actions.device.list);

  capitano.command(actions.device.supported);

  capitano.command(actions.device.rename);

  capitano.command(actions.device.init);

  capitano.command(actions.device.info);

  capitano.command(actions.device.remove);

  capitano.command(actions.device.identify);

  capitano.command(actions.drive.list);

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

  capitano.command(actions.logs.logs);

  capitano.command(actions.os.download);

  capitano.command(actions.os.install);

  capitano.command(actions.examples.list);

  capitano.command(actions.examples.clone);

  capitano.command(actions.examples.info);

  capitano.command(actions.plugin.list);

  capitano.command(actions.plugin.install);

  capitano.command(actions.plugin.update);

  capitano.command(actions.plugin.remove);

  capitano.command(actions.update.update);

  changeProjectDirectory = function(directory) {
    try {
      return process.chdir(directory);
    } catch (_error) {
      return errors.handle(new Error("Invalid project: " + directory));
    }
  };

  async.waterfall([
    function(callback) {
      return update.check(callback);
    }, function(callback) {
      return plugins.register('resin-plugin-', callback);
    }, function(callback) {
      var dataPrefix;
      dataPrefix = resin.settings.get('dataPrefix');
      return resin.data.prefix.set(dataPrefix, callback);
    }, function(callback) {
      var cli;
      cli = capitano.parse(process.argv);
      if (cli.global.quiet) {
        console.info = _.noop;
      }
      if (cli.global.project != null) {
        changeProjectDirectory(cli.global.project);
      }
      return capitano.execute(cli, callback);
    }
  ], errors.handle);

}).call(this);
