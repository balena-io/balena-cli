declare module 'capitano' {
	export function parse(argv: string[]): Cli;

	export interface Cli {
		command: string;
		options: {};
		global: {};
	}

	export interface OptionDefinition {
		signature: string;
		description: string;
		parameter?: string;
		boolean?: boolean;
		alias?: string | string[];
	}

	export interface CommandDefinition<P = {}, O = {}> {
		signature: string;
		description: string;
		help: string;
		options?: OptionDefinition[];
		permission?: 'user';
		action(params: P, options: O, done: () => void): void;
	}

	export interface Command {
		signature: Signature;
		options: Option[];
		isWildcard(): boolean;
	}

	export interface Signature {
		hasParameters(): boolean;
		hasVariadicParameters(): boolean;
		isWildcard(): boolean;
		allowsStdin(): boolean;
	}

	export interface Option {
		signature: Signature;
		alias: string | string[];
		boolean: boolean;
		parameter: string;
		required: boolean | string;
	}

	export function command(command: CommandDefinition): void;

	export const state: {
		getMatchCommand: (
			signature: string,
			callback: (e: Error, cmd: Command) => void,
		) => void;
	};
}
