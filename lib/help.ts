import Help from '@oclif/plugin-help';
import * as indent from 'indent-string';
import { getChalk } from './utils/lazy';
import { renderList } from '@oclif/plugin-help/lib/list';
import { ExpectedError } from './errors';

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

	public showHelp(argv: string[]) {
		const chalk = getChalk();
		const subject = getHelpSubject(argv);
		if (!subject) {
			const verbose = argv.includes('-v') || argv.includes('--verbose');
			this.showCustomRootHelp(verbose);
			return;
		}

		const command = this.config.findCommand(subject);
		if (command) {
			this.showCommandHelp(command);
			return;
		}

		throw new ExpectedError(`command ${chalk.cyan.bold(subject)} not found`);
	}

	showCustomRootHelp(showAllCommands: boolean): void {
		const chalk = getChalk();
		const bold = chalk.bold;
		const cmd = chalk.cyan.bold;

		let commands = this.config.commands;
		commands = commands.filter((c) => this.opts.all || !c.hidden);

		// Get Primary Commands, sorted as in manual list
		const primaryCommands = this.manuallySortedPrimaryCommands.map((pc) => {
			return commands.find((c) => c.id === pc.replace(' ', ':'));
		});

		// Get the rest as Additional Commands
		const additionalCommands = commands.filter(
			(c) =>
				!this.manuallySortedPrimaryCommands.includes(c.id.replace(':', ' ')),
		);

		// Find longest usage, and pad usage of first command in each category
		// This is to ensure that both categories align visually
		const usageLength = commands
			.map((c) => c.usage?.length || 0)
			.reduce((longest, l) => {
				return l > longest ? l : longest;
			});

		if (
			typeof primaryCommands[0]?.usage === 'string' &&
			typeof additionalCommands[0]?.usage === 'string'
		) {
			primaryCommands[0].usage = primaryCommands[0].usage.padEnd(usageLength);
			additionalCommands[0].usage = additionalCommands[0].usage.padEnd(
				usageLength,
			);
		}

		// Output help
		console.log(bold('USAGE'));
		console.log('$ balena [COMMAND] [OPTIONS]');

		console.log(bold('\nPRIMARY COMMANDS'));
		console.log(this.formatCommands(primaryCommands));

		if (showAllCommands) {
			console.log(bold('\nADDITIONAL COMMANDS'));
			console.log(this.formatCommands(additionalCommands));
		} else {
			console.log(
				`\n${bold('...MORE')} run ${cmd(
					'balena help --verbose',
				)} to list additional commands.`,
			);
		}

		console.log(bold('\nGLOBAL OPTIONS'));
		console.log('  --help, -h');
		console.log('  --debug\n');

		console.log(
			`For help, visit our support forums: ${chalk.grey(
				'https://forums.balena.io',
			)}`,
		);
		console.log(
			`For bug reports or feature requests, see: ${chalk.grey(
				'https://github.com/balena-io/balena-cli/issues/',
			)}\n`,
		);
	}

	protected formatCommands(commands: any[]): string {
		if (commands.length === 0) {
			return '';
		}

		const body = renderList(
			commands
				.filter((c) => c.usage != null && c.usage !== '')
				.map((c) => [c.usage, this.formatDescription(c.description)]),
			{
				spacer: '\n',
				stripAnsi: this.opts.stripAnsi,
				maxWidth: this.opts.maxWidth - 2,
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
		'scan',
	];
}
