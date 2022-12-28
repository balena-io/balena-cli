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

declare module 'resin-cli-visuals' {
	export const Progress: new (...options: any[]) => any;

	export class Spinner {
		constructor(message?: string);
		spinner: any;
		start(): void;
		stop(): void;
	}

	export const SpinnerPromise: new <T>(options: {
		promise: T;
		startMessage: string;
		stopMessage: string;
	}) => T;

	export const table: {
		horizontal: (...options: any[]) => any;
		vertical: (...options: any[]) => any;
	};
	export const drive: (...options: any[]) => any;
}
