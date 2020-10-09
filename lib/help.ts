import Help from '@oclif/plugin-help';
import type * as Config from '@oclif/config';
import * as indent from 'indent-string';
import { getChalk } from './utils/lazy';
import { renderList } from '@oclif/plugin-help/lib/list';
import { ExpectedError } from './errors';

const manuallySortedPrimaryCommands = [
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

// Partially overrides standard implementation of help plugin
// https://oclif.io/docs/help_classes#extending-the-default-help-class
// https://github.com/oclif/plugin-help/blob/master/src/index.ts

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

		// If they've typed a topic (e.g. `balena os`) that isn't also a command (e.g. `balena device`)
		// then list the associated commands.
		const topicCommands = this.config.commands.filter((c) => {
			return c.id.startsWith(`${subject}:`);
		});
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

		throw new ExpectedError(`command ${chalk.cyan.bold(subject)} not found`);
	}

	protected showCustomRootHelp(showAllCommands: boolean): void {
		const chalk = getChalk();
		const bold = chalk.bold;
		const cmd = chalk.cyan.bold;

		let commands = this.config.commands as Config.Command[];
		commands = commands.filter((c) => this.opts.all || !c.hidden);

		// Get Primary Commands, sorted as in manual list
		const primaryCommands: Config.Command[] = manuallySortedPrimaryCommands.map(
			(pc) => {
				return commands.find((c) => c.id === pc.replace(' ', ':'))!;
			},
		);

		// Get the rest as Additional Commands
		const additionalCommands = commands.filter(
			(c) =>
				!manuallySortedPrimaryCommands.includes(c.id.replace(':', ' ')) &&
				c.id !== 'help',
		);

		// Find longest usage, and pad usage of first command in each category
		// This is to ensure that both categories align visually
		const longestUsageLength = commands
			.map((c) => this.getUsage(c).length || 0)
			.reduce((longest, l) => {
				return l > longest ? l : longest;
			});

		// Output help
		console.log(bold('USAGE'));
		console.log('$ balena [COMMAND] [OPTIONS]');

		console.log(bold('\nPRIMARY COMMANDS'));
		console.log(this.formatCommands(primaryCommands, longestUsageLength));

		if (showAllCommands) {
			console.log(bold('\nADDITIONAL COMMANDS'));
			console.log(this.formatCommands(additionalCommands, longestUsageLength));
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

	public showCommandHelp(command: Config.Command) {
		// Set usage here, to avoid overriding CommandHelp logic
		command.usage = this.getUsage(command);
		super.showCommandHelp(command);
	}

	protected formatCommands(
		commands: Config.Command[],
		longestUsageLength: number = 0,
	): string {
		if (commands.length === 0) {
			return '';
		}

		const body = renderList(
			commands.map((c) => [
				this.getUsage(c).padEnd(longestUsageLength),
				this.formatDescription(c.description),
			]),
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

	protected getUsage(command: Config.Command): string {
		if (command.usage) {
			return command.usage as string;
		}

		let usage = command.id.replace(/:/g, ' ');

		command.args.forEach((arg) => {
			const brackets = arg.required ? ['<', '>'] : ['[', ']'];
			if (!arg.hidden) {
				usage += ` ${brackets[0]}${arg.name}${brackets[1]}`;
			}
		});

		return usage;
	}
}
