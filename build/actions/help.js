(function() {
  var _, capitano, columnify, command, general, indent, parse, print;

  _ = require('lodash');

  _.str = require('underscore.string');

  capitano = require('capitano');

  columnify = require('columnify');

  parse = function(object) {
    return _.object(_.map(object, function(item) {
      var signature;
      if (item.alias != null) {
        signature = item.toString();
      } else {
        signature = item.signature.toString();
      }
      return [signature, item.description];
    }));
  };

  indent = function(text) {
    text = _.map(_.str.lines(text), function(line) {
      return '    ' + line;
    });
    return text.join('\n');
  };

  print = function(data) {
    return console.log(indent(columnify(data, {
      showHeaders: false,
      minWidth: 35
    })));
  };

  general = function(params, options, done) {
    var commands;
    console.log('Usage: resin [COMMAND] [OPTIONS]\n');
    console.log('Commands:\n');
    commands = _.reject(capitano.state.commands, function(command) {
      return command.isWildcard();
    });
    print(parse(commands));
    if (!_.isEmpty(capitano.state.globalOptions)) {
      console.log('\nGlobal Options:\n');
      print(parse(capitano.state.globalOptions));
    }
    return done();
  };

  command = function(params, options, done) {
    return capitano.state.getMatchCommand(params.command, function(error, command) {
      if (error != null) {
        return done(error);
      }
      if ((command == null) || command.isWildcard()) {
        return done(new Error("Command not found: " + params.command));
      }
      console.log("Usage: " + command.signature);
      if (command.help != null) {
        console.log("\n" + command.help);
      } else if (command.description != null) {
        console.log("\n" + (_.str.humanize(command.description)));
      }
      if (!_.isEmpty(command.options)) {
        console.log('\nOptions:\n');
        print(parse(command.options));
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
