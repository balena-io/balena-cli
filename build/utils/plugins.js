
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
  var _, capitano, nplugm, patterns;

  nplugm = require('nplugm');

  _ = require('lodash');

  capitano = require('capitano');

  patterns = require('./patterns');

  exports.register = function(regex) {
    return nplugm.list(regex).map(function(plugin) {
      var command;
      command = require(plugin);
      command.plugin = true;
      if (!_.isArray(command)) {
        return capitano.command(command);
      }
      return _.each(command, capitano.command);
    })["catch"](function(error) {
      return patterns.printErrorMessage(error.message);
    });
  };

}).call(this);
