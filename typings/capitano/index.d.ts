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

declare module 'capitano' {
	export function parse(argv: string[]): Cli;

	export interface Cli {
		command: string;
		options: object;
		global: {
			help?: boolean;
		};
	}

	export interface OptionDefinition {
		signature: string;
		description?: string;
		parameter?: string;
		// eslint-disable-next-line id-denylist
		boolean?: boolean;
		required?: string;
		alias?: string | string[];
	}

	export interface CommandDefinition<P = object, O = object> {
		signature: string;
		description?: string;
		help?: string;
		options?: Partial<OptionDefinition[]>;
		permission?: string; // This should be 'user' but without full typescript we cannot enforce it
		root?: boolean;
		primary?: boolean;
		hidden?: boolean;
		action(params: P, options: Partial<O>, done: () => void): void;
	}

	export interface Command {
		signature: Signature;
		options: Option[];
		isWildcard(): boolean;
		// You can pass whatever you want into a capitano command and it gets added as a prop
		[key: string]: any;
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
		// eslint-disable-next-line id-denylist
		boolean: boolean;
		parameter: string;
		required: boolean | string;
	}

	export function command<P, O>(command: CommandDefinition<P, O>): void;

	export const state: {
		getMatchCommand: (
			signature: string,
			callback: (e: Error, cmd: Command) => void,
		) => void;
		commands: Command[];
		globalOptions: OptionDefinition[];
	};

	export function run(
		command: string | string[],
		callback: (err: Error | null, result: any) => void,
	): void;
	export function execute(
		args: any,
		callback: (err?: Error, result: any) => void,
	): void;
	export function globalOption(option: OptionDefinition): void;
	export function permission(
		permissionName: string,
		callback: (done: () => void) => void,
	): void;
}
