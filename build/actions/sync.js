
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
  module.exports = {
    signature: 'sync [source]',
    description: '(beta) sync your changes with a device',
    help: 'WARNING: If you\'re running Windows, this command only supports `cmd.exe`.\n\nUse this command to sync your local changes to a certain device on the fly.\n\nThe `source` argument can be either a device uuid or an application name.\n\nYou can save all the options mentioned below in a `resin-sync.yml` file,\nby using the same option names as keys. For example:\n\n	$ cat $PWD/resin-sync.yml\n	source: src/\n	before: \'echo Hello\'\n	ignore:\n		- .git\n		- node_modules/\n	progress: true\n	verbose: false\n\nNotice that explicitly passed command options override the ones set in the configuration file.\n\nExamples:\n\n	$ resin sync MyApp\n	$ resin sync 7cf02a6\n	$ resin sync 7cf02a6 --port 8080\n	$ resin sync 7cf02a6 --ignore foo,bar\n	$ resin sync 7cf02a6 -v',
    permission: 'user',
    primary: true,
    options: [
      {
        signature: 'source',
        parameter: 'path',
        description: 'custom source path',
        alias: 's'
      }, {
        signature: 'ignore',
        parameter: 'paths',
        description: 'comma delimited paths to ignore when syncing',
        alias: 'i'
      }, {
        signature: 'before',
        parameter: 'command',
        description: 'execute a command before syncing',
        alias: 'b'
      }, {
        signature: 'progress',
        boolean: true,
        description: 'show progress',
        alias: 'p'
      }, {
        signature: 'port',
        parameter: 'port',
        description: 'ssh port',
        alias: 't'
      }, {
        signature: 'verbose',
        boolean: true,
        description: 'increase verbosity',
        alias: 'v'
      }
    ],
    action: function(params, options, done) {
      var patterns, resin, resinSync;
      resin = require('resin-sdk');
      resinSync = require('resin-sync');
      patterns = require('../utils/patterns');
      if (options.ignore != null) {
        options.ignore = options.ignore.split(',');
      }
      return resin.models.device.has(params.source).then(function(isValidUUID) {
        if (isValidUUID) {
          return params.source;
        }
        return patterns.inferOrSelectDevice(params.source);
      }).then(function(uuid) {
        return resinSync.sync(uuid, options);
      }).nodeify(done);
    }
  };

}).call(this);
