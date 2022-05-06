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

declare module 'publish-release' {
	interface PublishOptions {
		token: string;
		owner: string;
		repo: string;
		tag: string;
		name: string;
		reuseRelease?: boolean;
		assets: string[];
	}

	interface Release {
		html_url: string;
	}

	let publishRelease: (
		args: PublishOptions,
		callback: (e: Error, release: Release) => void,
	) => void;

	export = publishRelease;
}
