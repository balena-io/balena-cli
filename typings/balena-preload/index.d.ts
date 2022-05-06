declare module 'balena-preload' {
	export class Preloader {
		constructor(...args: any[]);

		cleanup(): Promise<void>;

		on(...args: any[]): void;

		preload(): Promise<void>;

		prepare(): Promise<void>;

		setAppIdAndCommit(appId: string | number, commit: string): Promise<void>;

		config: any;

		stderr: any;
	}
}
