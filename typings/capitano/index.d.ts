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
		root?: boolean;
		primary?: boolean;
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
