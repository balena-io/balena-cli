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

// Based on the official types at:
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/update-notifier/index.d.ts
// but fixed to handle options correctly

declare module 'update-notifier' {
	export = UpdateNotifier;

	function UpdateNotifier(
		settings?: UpdateNotifier.Settings,
	): UpdateNotifier.UpdateNotifier;

	namespace UpdateNotifier {
		class UpdateNotifier {
			constructor(settings?: Settings);

			public update: UpdateInfo;
			public check(): void;
			public checkNpm(): void;
			public notify(customMessage?: NotifyOptions): void;
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
