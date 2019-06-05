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
import * as _ from 'lodash';

import EnvAddCmd from '../actions-oclif/env/add';

export function getOclifHelpLinePairs(): [[string, string]] {
	return [getCmdUsageDescriptionLinePair(EnvAddCmd)];
}

function getCmdUsageDescriptionLinePair(cmd: typeof Command): [string, string] {
	const usage = (cmd.usage || '').toString().toLowerCase();
	let description = '';
	// note: [^] matches any characters (including line breaks), achieving the
	// same effect as the 's' regex flag which is only supported by Node 9+
	const matches = /\s*([^]+?)\n[^]*/.exec(cmd.description || '');
	if (matches && matches.length > 1) {
		description = _.lowerFirst(_.trimEnd(matches[1], '.'));
	}
	return [usage, description];
}
