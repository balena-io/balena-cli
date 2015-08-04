(function() {
  module.exports = {
    app: require('./app'),
    info: require('./info'),
    auth: require('./auth'),
    device: require('./device'),
    env: require('./environment-variables'),
    keys: require('./keys'),
    logs: require('./logs'),
    notes: require('./notes'),
    preferences: require('./preferences'),
    help: require('./help'),
    examples: require('./examples'),
    plugin: require('./plugin')
  };

}).call(this);
