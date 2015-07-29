(function() {
  var Nplugm, _, capitano, nplugm, registerPlugin;

  Nplugm = require('nplugm');

  _ = require('lodash');

  capitano = require('capitano');

  nplugm = null;

  registerPlugin = function(plugin) {
    if (!_.isArray(plugin)) {
      return capitano.command(plugin);
    }
    return _.each(plugin, capitano.command);
  };

  exports.register = function(prefix, callback) {
    nplugm = new Nplugm(prefix);
    return nplugm.list(function(error, plugins) {
      var i, len, plugin;
      if (error != null) {
        return callback(error);
      }
      for (i = 0, len = plugins.length; i < len; i++) {
        plugin = plugins[i];
        try {
          registerPlugin(nplugm.require(plugin));
        } catch (_error) {
          error = _error;
          console.error(error.message);
        }
      }
      return callback();
    });
  };

  exports.list = function() {
    return nplugm.list.apply(nplugm, arguments);
  };

  exports.install = function() {
    return nplugm.install.apply(nplugm, arguments);
  };

  exports.update = function() {
    return nplugm.update.apply(nplugm, arguments);
  };

  exports.remove = function() {
    return nplugm.remove.apply(nplugm, arguments);
  };

}).call(this);
