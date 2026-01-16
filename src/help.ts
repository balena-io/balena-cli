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
import type { Command } from '@oclif/core';
import { Help } from '@oclif/core';
import indent from 'indent-string';
import type { ResolvableReturnType } from 'balena-sdk/typings/utils';
import { getCliUx } from './utils/lazy.js';

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

// See: https://github.com/oclif/core/blob/4.8.0/src/help/index.ts#L54
export default class BalenaHelp extends Help {
	private formatCommandsTitle: string | null = null;

	public async showCommandHelp(command: Command.Loadable): Promise<void> {
		this.formatCommandsTitle = 'SUB COMMANDS';
		await super.showCommandHelp(command);
	}

	public async showHelp(argv: string[]) {
		const ux = getCliUx();
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

	async getCustomRootHelp(showAllCommands: boolean): Promise<string> {
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

		const { deprecationPolicyNote, reachingOut } = await import(
			'./utils/messages.js'
		);

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

		if (this.formatCommandsTitle) {
			this.log(this.formatCommandsTitle);
			this.formatCommandsTitle = null;
		}
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
