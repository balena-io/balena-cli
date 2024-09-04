/**
 * @license
 * Copyright 2019 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Flags } from '@oclif/core';
import { stripIndent } from './lazy.js';

import { ExpectedError } from '../errors.js';

export const booleanConfig = Flags.boolean({
	char: 'c',
	description:
		'select a configuration variable (may be used together with the --device option)',
	default: false,
	exclusive: ['service'],
});

export const booleanDevice = Flags.boolean({
	char: 'd',
	description: 'select a device-specific variable instead of a fleet variable',
	default: false,
});

export const booleanService = Flags.boolean({
	char: 's',
	description:
		'select a service variable (may be used together with the --device option)',
	default: false,
	exclusive: ['config'],
});

export const rmRenameHelp = stripIndent`
	Variables are selected by their database ID (as reported by the 'balena envs'
	command) and one of six database "resource types":

	- fleet environment variable
	- fleet configuration variable (--config)
	- fleet service variable (--service)
	- device environment variable (--device)
	- device configuration variable (--device --config)
	- device service variable (--device --service)

	The --device option selects a device-specific variable instead of a fleet
	variable.

	The --config option selects a configuration variable. Configuration variable
	names typically start with the 'BALENA_' or 'RESIN_' prefixes and are used to
	configure balena platform features.

	The --service option selects a service variable, which is an environment variable
	that applies to a specifc service (container) in a microservices (multicontainer)
	fleet.

	The --service and --config options cannot be used together, but they can be
	used alongside the --device option to select a device-specific service or
	configuration variable.
`;

/**
 * Return an API database resource name like 'device_config_variable' or
 * 'service_environment_variable' given three boolean arguments.
 * @param isConfig Whether the resource is a configuration variable
 * @param isDevice Whether the resource is a device variable
 * @param isService Whether the resource is a service variable
 */
export function getVarResourceName(
	isConfig: boolean,
	isDevice: boolean,
	isService: boolean,
): string {
	return isDevice
		? isConfig
			? 'device_config_variable'
			: isService
				? 'device_service_environment_variable'
				: 'device_environment_variable'
		: isConfig
			? 'application_config_variable'
			: isService
				? 'service_environment_variable'
				: 'application_environment_variable';
}

/**
 * Check that the given string looks like and parses like a decimal integer,
 * and return the parsed value.
 */
export function parseDbId(id: string): number {
	if (/^[\d]+$/.exec(id) == null) {
		throw new ExpectedError("The variable's ID must be an integer");
	}
	return Number(id);
}
