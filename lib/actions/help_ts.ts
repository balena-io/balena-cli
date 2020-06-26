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

import * as _ from 'lodash';
import * as path from 'path';
import Command from '../command';

import { capitanoizeOclifUsage } from '../utils/oclif-utils';

export async function getOclifHelpLinePairs() {
	const { convertedCommands } = await import('../preparser');
	const primary: Array<[string, string]> = [];
	const secondary: Array<[string, string]> = [];

	for (const convertedCmd of convertedCommands) {
		const [topic, cmd] = convertedCmd.split(':');
		const pathComponents = ['..', 'actions-oclif', topic];
		if (cmd) {
			pathComponents.push(cmd);
		}

		const cmdModule = await import(path.join(...pathComponents));
		const command: typeof Command = cmdModule.default;

		if (!command.hidden) {
			if (command.primary) {
				primary.push(getCmdUsageDescriptionLinePair(command));
			} else {
				secondary.push(getCmdUsageDescriptionLinePair(command));
			}
		}
	}

	return { primary, secondary };
}

function getCmdUsageDescriptionLinePair(cmd: typeof Command): [string, string] {
	const usage = capitanoizeOclifUsage(cmd.usage);
	let description = '';
	// note: [^] matches any characters (including line breaks), achieving the
	// same effect as the 's' regex flag which is only supported by Node 9+
	const matches = /\s*([^]+?)\n[^]*/.exec(cmd.description || '');
	if (matches && matches.length > 1) {
		description = _.trimEnd(matches[1], '.');
		// Only do .lowerFirst() if the second char is not uppercase (e.g. for 'SSH');
		if (description[1] !== description[1]?.toUpperCase()) {
			description = _.lowerFirst(description);
		}
	}
	return [usage, description];
}
