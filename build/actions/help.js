(function() {
  var PADDING_INITIAL, PADDING_MIDDLE, _, addAlias, addOptionPrefix, buildHelpString, buildOptionSignatureHelp, capitano, command, general, getCommandHelp, getFieldMaxLength, getOptionHelp, getOptionsParsedSignatures, resin;

  _ = require('lodash');

  _.str = require('underscore.string');

  resin = require('resin-sdk');

  capitano = require('capitano');

  PADDING_INITIAL = '    ';

  PADDING_MIDDLE = '\t';

  getFieldMaxLength = function(array, field) {
    return _.max(_.map(array, function(item) {
      return item[field].toString().length;
    }));
  };

  buildHelpString = function(firstColumn, secondColumn) {
    var result;
    result = "" + PADDING_INITIAL + firstColumn;
    result += "" + PADDING_MIDDLE + secondColumn;
    return result;
  };

  addOptionPrefix = function(option) {
    if (option.length <= 0) {
      return;
    }
    if (option.length === 1) {
      return "-" + option;
    } else {
      return "--" + option;
    }
  };

  addAlias = function(alias) {
    return ", " + (addOptionPrefix(alias));
  };

  buildOptionSignatureHelp = function(option) {
    var alias, i, len, ref, result;
    result = addOptionPrefix(option.signature.toString());
    if (_.isString(option.alias)) {
      result += addAlias(option.alias);
    } else if (_.isArray(option.alias)) {
      ref = option.alias;
      for (i = 0, len = ref.length; i < len; i++) {
        alias = ref[i];
        result += addAlias(alias);
      }
    }
    if (option.parameter != null) {
      result += " <" + option.parameter + ">";
    }
    return result;
  };

  getCommandHelp = function(command) {
    var commandSignature, maxSignatureLength;
    maxSignatureLength = getFieldMaxLength(capitano.state.commands, 'signature');
    commandSignature = _.str.rpad(command.signature.toString(), maxSignatureLength, ' ');
    return buildHelpString(commandSignature, command.description);
  };

  getOptionsParsedSignatures = function(optionsHelp) {
    var maxLength;
    maxLength = _.max(_.map(optionsHelp, function(signature) {
      return signature.length;
    }));
    return _.map(optionsHelp, function(signature) {
      return _.str.rpad(signature, maxLength, ' ');
    });
  };

  getOptionHelp = function(option, maxLength) {
    var result;
    result = PADDING_INITIAL;
    result += _.str.rpad(option.signature, maxLength, ' ');
    result += PADDING_MIDDLE;
    result += option.description;
    return result;
  };

  general = function() {
    var command, i, j, len, len1, option, optionSignatureMaxLength, options, ref;
    console.log('Usage: resin [COMMAND] [OPTIONS]\n');
    console.log('Commands:\n');
    ref = capitano.state.commands;
    for (i = 0, len = ref.length; i < len; i++) {
      command = ref[i];
      if (command.isWildcard()) {
        continue;
      }
      console.log(getCommandHelp(command));
    }
    console.log('\nGlobal Options:\n');
    options = _.map(capitano.state.globalOptions, function(option) {
      option.signature = buildOptionSignatureHelp(option);
      return option;
    });
    optionSignatureMaxLength = _.max(_.map(options, function(option) {
      return option.signature.length;
    }));
    for (j = 0, len1 = options.length; j < len1; j++) {
      option = options[j];
      console.log(getOptionHelp(option, optionSignatureMaxLength));
    }
    return console.log();
  };

  command = function(params, options, done) {
    return capitano.state.getMatchCommand(params.command, function(error, command) {
      var i, len, option, optionSignatureMaxLength;
      if (error != null) {
        return done(error);
      }
      if ((command == null) || command.isWildcard()) {
        return capitano.defaults.actions.commandNotFound(params.command);
      }
      console.log("Usage: " + command.signature);
      if (command.help != null) {
        console.log("\n" + command.help);
      } else if (command.description != null) {
        console.log("\n" + (_.str.humanize(command.description)));
      }
      if (!_.isEmpty(command.options)) {
        console.log('\nOptions:\n');
        options = _.map(command.options, function(option) {
          option.signature = buildOptionSignatureHelp(option);
          return option;
        });
        optionSignatureMaxLength = _.max(_.map(options, function(option) {
          return option.signature.toString().length;
        }));
        for (i = 0, len = options.length; i < len; i++) {
          option = options[i];
          console.log(getOptionHelp(option, optionSignatureMaxLength));
        }
        console.log();
      }
      return done();
    });
  };

  exports.help = {
    signature: 'help [command...]',
    description: 'show help',
    help: 'Get detailed help for an specific command.\n\nExamples:\n\n	$ resin help apps\n	$ resin help os download',
    action: function(params, options, done) {
      if (params.command != null) {
        return command(params, options, done);
      } else {
        return general(params, options, done);
      }
    }
  };

}).call(this);
