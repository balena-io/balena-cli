// Based on the official types at https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/update-notifier/index.d.ts
// but fixed to handle options correctly

declare module 'update-notifier' {
	export = UpdateNotifier;

	function UpdateNotifier(
		settings?: UpdateNotifier.Settings,
	): UpdateNotifier.UpdateNotifier;

	namespace UpdateNotifier {
		class UpdateNotifier {
			constructor(settings?: Settings);

			update: UpdateInfo;
			check(): void;
			checkNpm(): void;
			notify(customMessage?: NotifyOptions): void;
		}

		interface Settings {
			pkg?: Package;
			callback?(update?: UpdateInfo): any;
			packageName?: string;
			packageVersion?: string;
			updateCheckInterval?: number; // in milliseconds, default 1000 * 60 * 60 * 24 (1 day)
		}

		interface BoxenOptions {
			padding: number;
			margin: number;
			align: string;
			borderColor: string;
			borderStyle: string;
		}

		interface NotifyOptions {
			message?: string;
			defer?: boolean;
			boxenOpts?: BoxenOptions;
		}

		interface Package {
			name: string;
			version: string;
		}

		interface UpdateInfo {
			latest: string;
			current: string;
			type: string;
			name: string;
		}
	}
}
