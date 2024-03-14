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

declare module 'balena-device-init' {
	import { DeviceTypeJson } from 'balena-sdk';
	import type * as Bluebird from 'bluebird';

	interface OperationState {
		operation:
			| CopyOperation
			| ReplaceOperation
			| RunScriptOperation
			| BurnOperation;
		percentage: number;
	}

	interface Operation {
		command: string;
	}

	interface CopyOperation extends Operation {
		command: 'copy';
		from: { path: string };
		to: { path: string };
	}

	interface ReplaceOperation extends Operation {
		command: 'replace';
		copy: string;
		replace: string;
		file: {
			path: string;
		};
	}

	interface RunScriptOperation extends Operation {
		command: 'run-script';
		script: string;
		arguments?: string[];
	}

	interface BurnOperation extends Operation {
		command: 'burn';
		image?: string;
	}

	interface BurnProgress {
		type: 'write' | 'check';
		percentage: number;
		transferred: number;
		length: number;
		remaining: number;
		eta: number;
		runtime: number;
		delta: number;
		speed: number;
	}

	interface InitializeEmitter {
		on(event: 'stdout' | 'stderr', callback: (msg: string) => void): void;
		on(event: 'state', callback: (state: OperationState) => void): void;
		on(event: 'burn', callback: (state: BurnProgress) => void): void;
		on(event: 'end', callback: () => void): void;
		on(event: 'error', callback: (error: Error) => void): void;
	}

	export function configure(
		image: string,
		manifest: BalenaSdk.DeviceTypeJson.DeviceType.DeviceType,
		config: object,
		options?: object,
	): Bluebird<InitializeEmitter>;

	export function initialize(
		image: string,
		manifest: BalenaSdk.DeviceTypeJson.DeviceType.DeviceType,
		config: object,
	): Bluebird<InitializeEmitter>;

	export function getImageOsVersion(
		image: string,
		manifest: BalenaSdk.DeviceTypeJson.DeviceType.DeviceType,
	): Bluebird<string | null>;

	export function getImageManifest(
		image: string,
	): Bluebird<BalenaSdk.DeviceTypeJson.DeviceType.DeviceType | null>;
}
