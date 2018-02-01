/*
Copyright 2016-2018 Resin.io

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

import _ = require('lodash');

export function normalizeCommands(commands: {
	[key: string]: { action?: () => any };
}) {
	_.forEach(commands, normalizeActionParams);
	return commands;
}

export function normalizeActionParams(commandDefinition: {
	action?: () => any;
}) {
	const action = commandDefinition.action;
	if (_.isFunction(action)) {
		commandDefinition.action = function() {
			const [params, options] = _.toArray(arguments);

			if (_.isNumber(params.uuid)) params.uuid = _.toString(params.uuid);

			// in some methods this is a boolean
			if (_.isNumber(options.device))
				options.device = _.toString(options.device);

			action.apply(this, arguments);
		};
	}
}
