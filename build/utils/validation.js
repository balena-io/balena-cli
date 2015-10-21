(function() {
  var validEmail;

  validEmail = require('valid-email');

  exports.validateEmail = function(input) {
    if (!validEmail(input)) {
      return 'Email is not valid';
    }
    return true;
  };

  exports.validatePassword = function(input) {
    if (input.length < 8) {
      return 'Password should be 8 characters long';
    }
    return true;
  };

  exports.validateApplicationName = function(input) {
    if (input.length < 4) {
      return 'The application name should be at least 4 characters';
    }
    return true;
  };

}).call(this);
