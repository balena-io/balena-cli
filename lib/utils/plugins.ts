/*
Copyright 2016-2017 Resin.io

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

import nplugm = require('nplugm');
import _ = require('lodash');
import capitano = require('capitano');
import patterns = require('./patterns');

export function register(regex: RegExp): Promise<void> {
	return nplugm.list(regex).map(async function(plugin: any) {
		const command = await import(plugin);
		command.plugin = true;
		if (!_.isArray(command)) {
			return capitano.command(command);
		}
		return _.each(command, capitano.command);
	}).catch((error: Error) => {
		return patterns.printErrorMessage(error.message);
	});
}
