
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
    wizard: require('./wizard'),
    app: require('./app'),
    info: require('./info'),
    auth: require('./auth'),
    device: require('./device'),
    env: require('./environment-variables'),
    keys: require('./keys'),
    logs: require('./logs'),
    notes: require('./notes'),
    help: require('./help'),
    os: require('./os'),
    settings: require('./settings'),
    config: require('./config'),
    sync: require('./sync'),
    ssh: require('./ssh')
  };

}).call(this);
