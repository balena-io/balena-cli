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

declare module 'resin-cli-form' {
	export type TypeOrPromiseLike<T> = T | PromiseLike<T>;

	export type Validate = (
		input: any,
	) => TypeOrPromiseLike<boolean | string | undefined>;

	export interface AskOptions<T> {
		message: string;
		type?: string;
		name?: string;
		default?: T;
		choices?: Array<{
			name: string;
			value: T;
		}>;
		validate?: Validate;
	}

	export interface RunQuestion {
		message: string;
		name: string;
		type?: string;
		validate?: Validate;
	}

	// As of writing this, these are Bluebird promises, but we are typing then
	// as normal Promises so that we do not rely on Bluebird specific methods,
	// so that the CLI will not require any change once the package drops Bluebird.

	export const ask: <T = string>(options: AskOptions<T>) => Promise<T>;
	export const run: <T = any>(
		questions?: RunQuestion[],
		extraOptions?: { override?: object },
	) => Promise<T>;
}
