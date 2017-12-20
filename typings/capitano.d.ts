declare module 'capitano' {
	export function parse(argv: string[]): Cli;

	export interface Cli {
		command: string;
		options: {};
		global: {};
	}

	export interface CommandOption {
		signature: string;
		description: string;
		parameter?: string;
		boolean?: boolean;
		alias?: string | string[];
	}

	export interface Command<P = {}, O = {}> {
		signature: string;
		description: string;
		help: string;
		options?: CommandOption[],
		permission?: 'user',
		action(params: P, options: O, done: () => void): void;
	}

	export interface BuiltCommand {
		signature: {}
	}

	export function command(command: Command): void;

	export const state: {
		getMatchCommand: (signature: string, callback: (e: Error, cmd: BuiltCommand) => void) => void
	};
}
