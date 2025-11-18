/**
 * @license
 * Copyright 2017-2020 Balena Ltd.
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
import type { Command, Interfaces } from '@oclif/core';
import { Help } from '@oclif/core';
import * as indent from 'indent-string';
import type { ResolvableReturnType } from 'balena-sdk/typings/utils';
import { getCliUx } from './utils/lazy';

// Partially overrides standard implementation of help plugin
// https://github.com/oclif/plugin-help/blob/master/src/index.ts

function getHelpSubject(args: string[]): string | undefined {
	for (const arg of args) {
		if (arg === '--') {
			return;
		}
		if (arg === 'help' || arg === '--help') {
			continue;
		}
		if (arg.startsWith('-')) {
			return;
		}
		return arg;
	}
}

// See: https://github.com/oclif/core/blob/v1.16.4/src/help/index.ts#L45
export default class BalenaHelp extends Help {
	private SUPPRESS_SUBTOPICS_DEPTH: number | null = null;

	protected get sortedCommands(): Command.Loadable[] {
		const commands = super.sortedCommands;
		if (this.SUPPRESS_SUBTOPICS_DEPTH == null) {
			return commands;
		}
		// Assign it to a const so that TS knows that this can't change to null during the .filter
		const depth = this.SUPPRESS_SUBTOPICS_DEPTH;
		// This is excluding all commands with a depth higher than the SUPPRESS_SUBTOPICS_DEPTH
		// so that when the base `showCommandHelp` is called and it accesses this.sortedCommands
		// it will not find any sub-commands and hence will not print them.
		// https://github.com/oclif/core/blob/v1.16.4/src/help/index.ts#L137-L138
		// eg: when doing `balena device --help`, which has a depth of 1, this will omit commands
		// like 'device:deactivate', 'device:init' etc since they have depth of 2.
		return commands.filter((c) => c.id.split(':').length <= depth);
	}

	protected get sortedTopics(): Interfaces.Topic[] {
		const topics = super.sortedTopics;
		if (this.SUPPRESS_SUBTOPICS_DEPTH == null) {
			return topics;
		}
		// Assign it to a const so that TS knows that this can't change to null during the .filter
		const depth = this.SUPPRESS_SUBTOPICS_DEPTH;
		// This is excluding all topics with a depth higher than the SUPPRESS_SUBTOPICS_DEPTH
		// so that when the base `showCommandHelp` is called and it accesses this.sortedTopics
		// it will not find any sub-topics and hence will not print them.
		// https://github.com/oclif/core/blob/v1.16.4/src/help/index.ts#L137-L138
		// We atm do not have any-sub-topic to give an example for
		return topics.filter((t) => t.name.split(':').length <= depth);
	}

	public async showCommandHelp(command: Command.Loadable): Promise<void> {
		const name = command.id;
		const depth = name.split(':').length;
		this.SUPPRESS_SUBTOPICS_DEPTH = depth;
		await super.showCommandHelp(command);
		this.SUPPRESS_SUBTOPICS_DEPTH = null;
	}

	public async showHelp(argv: string[]) {
		const ux = getCliUx();
		const subject = getHelpSubject(argv);
		if (!subject) {
			const verbose = argv.includes('-v') || argv.includes('--verbose');
			console.log(this.getCustomRootHelp(verbose));
			return;
		}

		const command = this.config.findCommand(subject);
		if (command) {
			await this.showCommandHelp(command);
			return;
		}

		// If they've typed a topic (e.g. `balena os`) that isn't also a command (e.g. `balena device`)
		// then list the associated commands.
		const topicCommands = await Promise.all(
			this.config.commands
				.filter((c) => {
					return c.id.startsWith(`${subject}:`);
				})
				.map((topic) => topic.load()),
		);

		if (topicCommands.length > 0) {
			console.log(`${ux.colorize('yellow', subject)} commands include:`);
			console.log(this.formatCommands(topicCommands));
			console.log(
				`\nRun ${ux.colorize('bold', ux.colorize('cyan', 'balena help -v'))} for a list of all available commands,`,
			);
			console.log(
				` or ${ux.colorize('bold', ux.colorize('cyan', 'balena help <command>'))} for detailed help on a specific command.`,
			);
			return;
		}

		console.log(
			`command ${ux.colorize('bold', ux.colorize('cyan', subject))} not found`,
		);
	}

	getCustomRootHelp(showAllCommands: boolean): string {
		const ux = getCliUx();
		let commands = this.config.commands;
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		commands = commands.filter((c) => this.opts.all || !c.hidden);

		// Get Primary Commands, sorted as in manual list
		const primaryCommands = this.manuallySortedPrimaryCommands
			.map((pc) => {
				return commands.find((c) => c.id === pc.replace(' ', ':'));
			})
			.filter((c): c is (typeof commands)[0] => !!c);

		let cmdLength = 0;
		for (const cmd of primaryCommands) {
			cmdLength = Math.max(cmdLength, cmd.id.length);
		}

		let additionalCmdSection: string[];
		if (showAllCommands) {
			// Get the rest as Additional Commands
			const additionalCommands = commands.filter(
				(c) =>
					!this.manuallySortedPrimaryCommands.includes(c.id.replace(':', ' ')),
			);

			// Find longest usage, and pad usage of first command in each category
			// This is to ensure that both categories align visually
			for (const cmd of additionalCommands) {
				cmdLength = Math.max(cmdLength, cmd.id.length);
			}

			if (
				typeof primaryCommands[0].id === 'string' &&
				typeof additionalCommands[0].id === 'string'
			) {
				primaryCommands[0].id = primaryCommands[0].id.padEnd(cmdLength);
				additionalCommands[0].id = additionalCommands[0].id.padEnd(cmdLength);
			}

			additionalCmdSection = [
				ux.colorize('bold', '\nADDITIONAL COMMANDS'),
				this.formatCommands(additionalCommands),
			];
		} else {
			const cmd = ux.colorize(
				'bold',
				ux.colorize('cyan', 'balena help --verbose'),
			);
			additionalCmdSection = [
				`\n${ux.colorize('bold', '...MORE')} run ${cmd} to list additional commands.`,
			];
		}

		const globalOps = [
			['--help', 'display command help'],
			['--debug', 'enable debug output'],
			[
				'--unsupported',
				`\
prevent exit with an error as per Deprecation Policy
See: https://git.io/JRHUW#deprecation-policy`,
			],
		];
		globalOps[0][0] = globalOps[0][0].padEnd(cmdLength);

		const { deprecationPolicyNote, reachingOut } =
			require('./utils/messages') as typeof import('./utils/messages');

		return [
			ux.colorize('bold', 'USAGE'),
			'$ balena [COMMAND] [OPTIONS]',
			ux.colorize('bold', '\nPRIMARY COMMANDS'),
			this.formatCommands(primaryCommands),
			...additionalCmdSection,
			ux.colorize('bold', '\nGLOBAL OPTIONS'),
			this.formatGlobalOpts(globalOps),
			ux.colorize('bold', '\nDeprecation Policy Reminder'),
			deprecationPolicyNote,
			reachingOut,
		].join('\n');
	}

	protected formatGlobalOpts(opts: string[][]) {
		const ux = getCliUx();
		const outLines: string[] = [];
		let flagWidth = 0;
		for (const opt of opts) {
			flagWidth = Math.max(flagWidth, opt[0].length);
		}
		for (const opt of opts) {
			const descriptionLines = opt[1].split('\n');
			outLines.push(
				`  ${opt[0].padEnd(flagWidth + 2)}${ux.colorize('dim', descriptionLines[0])}`,
			);
			outLines.push(
				...descriptionLines
					.slice(1)
					.map(
						(line) =>
							`  ${' '.repeat(flagWidth + 2)}${ux.colorize('dim', line)}`,
					),
			);
		}
		return outLines.join('\n');
	}

	protected formatCommands(
		commands: Array<
			Command.Loadable | ResolvableReturnType<Command.Loadable['load']>
		>,
	): string {
		if (commands.length === 0) {
			return '';
		}

		const body = this.renderList(
			commands.map((c) => [
				c.id.replaceAll(':', ' '),
				this.formatDescription(c.description),
			]),
			{
				spacer: '\n',
				stripAnsi: this.opts.stripAnsi,
				indentation: 2,
				multiline: false,
			},
		);

		return indent(body, 2);
	}

	protected formatDescription(desc = '') {
		const ux = getCliUx();
		desc = desc.split('\n')[0];
		// Remove any ending .
		if (desc.endsWith('.')) {
			desc = desc.substring(0, desc.length - 1);
		}
		// Lowercase first letter if second char is lowercase, to preserve e.g. 'SSH ...')
		if (desc.length > 1 && desc[1] === desc[1].toLowerCase()) {
			desc = `${desc[0].toLowerCase()}${desc.substring(1)}`;
		}
		return ux.colorize('gray', desc);
	}

	readonly manuallySortedPrimaryCommands = [
		'login',
		'push',
		'fleet',
		'device',
		'preload',
		'build',
		'deploy',
		'join',
		'leave',
	];
}
