declare module 'balena-device-init' {
	import * as Promise from 'bluebird';
	import { EventEmitter } from 'events';
	import { DeviceType } from 'balena-sdk';

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
		on(event: 'stdout', callback: (msg: string) => void): void;
		on(event: 'stderr', callback: (msg: string) => void): void;
		on(event: 'state', callback: (state: OperationState) => void): void;
		on(event: 'burn', callback: (state: BurnProgress) => void): void;
	}

	export function configure(
		image: string,
		manifest: DeviceType,
		config: {},
		options?: {},
	): Promise<InitializeEmitter>;

	export function initialize(
		image: string,
		manifest: DeviceType,
		config: {},
	): Promise<InitializeEmitter>;

	export function getImageOsVersion(
		image: string,
		manifest: DeviceType,
	): Promise<string | null>;

	export function getImageManifest(image: string): Promise<DeviceType | null>;
}
