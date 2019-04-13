/*
Copyright 2016-2019 Balena

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

import * as BalenaSync from 'balena-sync';
import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';

export = deprecateSyncCmd(BalenaSync.capitano('balena-cli'));

const deprecationMsg = stripIndent`\
	- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
	Deprecation notice: please note that \`balena sync\` is deprecated and will
	be removed in a future release of the CLI. We are working on an exciting
	replacement that will be released soon!  
	- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
`;

function deprecateSyncCmd(syncCmd: CommandDefinition): CommandDefinition {
	syncCmd.primary = false;
	syncCmd.description = syncCmd.description.replace(
		'(beta)',
		'[deprecated: see "help sync"]',
	);
	syncCmd.help = deprecationMsg + '\n\n' + syncCmd.help;
	const originalAction = syncCmd.action;
	syncCmd.action = (params, options, done): void => {
		console.log(deprecationMsg);
		originalAction(params, options, done);
	};
	return syncCmd;
}
