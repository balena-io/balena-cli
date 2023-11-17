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
import { Help } from '@oclif/core';
import indent from 'indent-string';
import { getChalk } from './utils/lazy.js';

// Partially overrides standard implementation of help plugin
// https://github.com/oclif/plugin-help/blob/master/src/index.ts

function getHelpSubject(args: string[]): string | undefined {
	for (const arg of args) {
		if (arg === '--') {
			return;
		}
		if (arg === 'help' || arg === '--help' || arg === '-h') {
			continue;
		}
		if (arg.startsWith('-')) {
			return;
		}
		return arg;
	}
}

export default class BalenaHelp extends Help {
	public static usage: 'help [command]';

	public async showHelp(argv: string[]) {
		const chalk = getChalk();
		const subject = getHelpSubject(argv);
		if (!subject) {
			const verbose = argv.includes('-v') || argv.includes('--verbose');
			console.log(await this.getCustomRootHelp(verbose));
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
			console.log(`${chalk.yellow(subject)} commands include:`);
			console.log(this.formatCommands(topicCommands));
			console.log(
				`\nRun ${chalk.cyan.bold(
					'balena help -v',
				)} for a list of all available commands,`,
			);
			console.log(
				` or ${chalk.cyan.bold(
					'balena help <command>',
				)} for detailed help on a specific command.`,
			);
			return;
		}

		console.log(`command ${chalk.cyan.bold(subject)} not found`);
	}

	async getCustomRootHelp(showAllCommands: boolean): Promise<string> {
		const { bold, cyan } = getChalk();

		let commands = this.config.commands;
		commands = commands.filter((c) => this.opts.all || !c.hidden);

		// Get Primary Commands, sorted as in manual list
		const primaryCommands = this.manuallySortedPrimaryCommands
			.map((pc) => {
				return commands.find((c) => c.id === pc.replace(' ', ':'));
			})
			.filter((c): c is (typeof commands)[0] => !!c);

		let usageLength = 0;
		for (const cmd of primaryCommands) {
			usageLength = Math.max(usageLength, cmd.usage?.length || 0);
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
				usageLength = Math.max(usageLength, cmd.usage?.length || 0);
			}

			if (
				typeof primaryCommands[0].usage === 'string' &&
				typeof additionalCommands[0].usage === 'string'
			) {
				primaryCommands[0].usage = primaryCommands[0].usage.padEnd(usageLength);
				additionalCommands[0].usage =
					additionalCommands[0].usage.padEnd(usageLength);
			}

			additionalCmdSection = [
				bold('\nADDITIONAL COMMANDS'),
				this.formatCommands(additionalCommands),
			];
		} else {
			const cmd = cyan.bold('balena help --verbose');
			additionalCmdSection = [
				`\n${bold('...MORE')} run ${cmd} to list additional commands.`,
			];
		}

		const globalOps = [
			['--help, -h', 'display command help'],
			['--debug', 'enable debug output'],
			[
				'--unsupported',
				`\
prevent exit with an error as per Deprecation Policy
See: https://git.io/JRHUW#deprecation-policy`,
			],
		];
		globalOps[0][0] = globalOps[0][0].padEnd(usageLength);

		const { deprecationPolicyNote, reachingOut } = await import(
			'./utils/messages.js'
		);

		return [
			bold('USAGE'),
			'$ balena [COMMAND] [OPTIONS]',
			bold('\nPRIMARY COMMANDS'),
			this.formatCommands(primaryCommands),
			...additionalCmdSection,
			bold('\nGLOBAL OPTIONS'),
			this.formatGlobalOpts(globalOps),
			bold('\nDeprecation Policy Reminder'),
			deprecationPolicyNote,
			reachingOut,
		].join('\n');
	}

	protected formatGlobalOpts(opts: string[][]) {
		const { dim } = getChalk();
		const outLines: string[] = [];
		let flagWidth = 0;
		for (const opt of opts) {
			flagWidth = Math.max(flagWidth, opt[0].length);
		}
		for (const opt of opts) {
			const descriptionLines = opt[1].split('\n');
			outLines.push(
				`  ${opt[0].padEnd(flagWidth + 2)}${dim(descriptionLines[0])}`,
			);
			outLines.push(
				...descriptionLines
					.slice(1)
					.map((line) => `  ${' '.repeat(flagWidth + 2)}${dim(line)}`),
			);
		}
		return outLines.join('\n');
	}

	protected formatCommands(commands: any[]): string {
		if (commands.length === 0) {
			return '';
		}

		const body = this.renderList(
			commands
				.filter((c) => c.usage != null && c.usage !== '')
				.map((c) => [c.usage, this.formatDescription(c.description)]),
			{
				spacer: '\n',
				stripAnsi: this.opts.stripAnsi,
				indentation: 2,
				multiline: false,
			},
		);

		return indent(body, 2);
	}

	protected formatDescription(desc: string = '') {
		const chalk = getChalk();

		desc = desc.split('\n')[0];
		// Remove any ending .
		if (desc[desc.length - 1] === '.') {
			desc = desc.substring(0, desc.length - 1);
		}
		// Lowercase first letter if second char is lowercase, to preserve e.g. 'SSH ...')
		if (desc[1] === desc[1]?.toLowerCase()) {
			desc = `${desc[0].toLowerCase()}${desc.substring(1)}`;
		}
		return chalk.grey(desc);
	}

	readonly manuallySortedPrimaryCommands = [
		'login',
		'push',
		'logs',
		'ssh',
		'fleets',
		'fleet',
		'devices',
		'device',
		'tunnel',
		'preload',
		'build',
		'deploy',
		'join',
		'leave',
		'scan',
	];
}
