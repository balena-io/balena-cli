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

import { Command } from '@oclif/command';
import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import * as path from 'path';

import { capitanoizeOclifUsage } from '../utils/oclif-utils';

export async function getOclifHelpLinePairs(): Promise<
	Array<[string, string]>
> {
	const { convertedCommands } = await import('../preparser');
	const cmdClasses: Array<Promise<typeof Command>> = [];
	for (const convertedCmd of convertedCommands) {
		const [topic, cmd] = convertedCmd.split(':');
		const pathComponents = ['..', 'actions-oclif', topic];
		if (cmd) {
			pathComponents.push(cmd);
		}
		// note that `import(path)` returns a promise
		cmdClasses.push(import(path.join(...pathComponents)));
	}
	return Bluebird.map(cmdClasses, getCmdUsageDescriptionLinePair);
}

function getCmdUsageDescriptionLinePair(cmdModule: any): [string, string] {
	const cmd: typeof Command = cmdModule.default;
	const usage = capitanoizeOclifUsage(cmd.usage);
	let description = '';
	// note: [^] matches any characters (including line breaks), achieving the
	// same effect as the 's' regex flag which is only supported by Node 9+
	const matches = /\s*([^]+?)\n[^]*/.exec(cmd.description || '');
	if (matches && matches.length > 1) {
		description = _.lowerFirst(_.trimEnd(matches[1], '.'));
	}
	return [usage, description];
}
