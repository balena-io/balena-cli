/*
Copyright 2016-2020 Balena Ltd.

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

import * as _ from 'lodash';

import * as capitano from 'capitano';
import * as columnify from 'columnify';
import * as messages from '../utils/messages';
import { getManualSortCompareFunction } from '../utils/helpers';
import { exitWithExpectedError } from '../errors';
import { getOclifHelpLinePairs } from './help_ts';

const parse = (object) =>
	_.map(object, function (item) {
		// Hacky way to determine if an object is
		// a function or a command
		let signature;
		if (item.alias != null) {
			signature = item.toString();
		} else {
			signature = item.signature.toString();
		}

		return [signature, item.description];
	});

const indent = function (text) {
	text = _.map(text.split('\n'), (line) => '    ' + line);
	return text.join('\n');
};

const print = (usageDescriptionPairs) =>
	console.log(
		indent(
			columnify(_.fromPairs(usageDescriptionPairs), {
				showHeaders: false,
				minWidth: 35,
			}),
		),
	);

const manuallySortedPrimaryCommands = [
	'help',
	'login',
	'push',
	'logs',
	'ssh',
	'apps',
	'app',
	'devices',
	'device',
	'tunnel',
	'preload',
	'build',
	'deploy',
	'join',
	'leave',
	'local scan',
];

const general = function (_params, options, done) {
	console.log('Usage: balena [COMMAND] [OPTIONS]\n');

	console.log('Primary commands:\n');

	// We do not want the wildcard command
	// to be printed in the help screen.
	const commands = capitano.state.commands.filter(
		(command) => !command.hidden && !command.isWildcard(),
	);

	const capitanoCommands = _.groupBy(commands, function (command) {
		if (command.primary) {
			return 'primary';
		}
		return 'secondary';
	});

	return getOclifHelpLinePairs()
		.then(function (oclifHelpLinePairs) {
			const primaryHelpLinePairs = parse(capitanoCommands.primary)
				.concat(oclifHelpLinePairs.primary)
				.sort(
					getManualSortCompareFunction(manuallySortedPrimaryCommands, function (
						[signature],
						manualItem,
					) {
						return (
							signature === manualItem || signature.startsWith(`${manualItem} `)
						);
					}),
				);

			const secondaryHelpLinePairs = parse(capitanoCommands.secondary)
				.concat(oclifHelpLinePairs.secondary)
				.sort();

			print(primaryHelpLinePairs);

			if (options.verbose) {
				console.log('\nAdditional commands:\n');
				print(secondaryHelpLinePairs);
			} else {
				console.log(
					'\nRun `balena help --verbose` to list additional commands',
				);
			}

			if (!_.isEmpty(capitano.state.globalOptions)) {
				console.log('\nGlobal Options:\n');
				print(parse(capitano.state.globalOptions).sort());
			}
			console.log(indent('--debug\n'));

			console.log(messages.help);

			return done();
		})
		.catch(done);
};

const commandHelp = (params, _options, done) =>
	capitano.state.getMatchCommand(params.command, function (error, command) {
		if (error != null) {
			return done(error);
		}

		if (command == null || command.isWildcard()) {
			exitWithExpectedError(`Command not found: ${params.command}`);
		}

		console.log(`Usage: ${command.signature}`);

		if (command.help != null) {
			console.log(`\n${command.help}`);
		} else if (command.description != null) {
			console.log(`\n${_.capitalize(command.description)}`);
		}

		if (!_.isEmpty(command.options)) {
			console.log('\nOptions:\n');
			print(parse(command.options).sort());
		}

		console.log();

		return done();
	});

export const help = {
	signature: 'help [command...]',
	description: 'show help',
	help: `\
Get detailed help for an specific command.

Examples:

	$ balena help apps
	$ balena help os download\
`,
	primary: true,
	options: [
		{
			signature: 'verbose',
			description: 'show additional commands',
			boolean: true,
			alias: 'v',
		},
	],
	action(params, options, done) {
		if (params.command != null) {
			return commandHelp(params, options, done);
		} else {
			return general(params, options, done);
		}
	},
};
