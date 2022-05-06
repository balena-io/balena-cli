/**
 * @license
 * Copyright 2020 Balena Ltd.
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

import { NockMock } from './nock-mock';

const jHeader = { 'Content-Type': 'application/json' };

export class NpmMock extends NockMock {
	constructor() {
		super(/registry\.npmjs\.org/);
	}

	public expectGetBalenaCli({
		version,
		publishedAt,
		notFound = false,
		optional = false,
		persist = false,
	}: {
		version: string;
		publishedAt: string;
		notFound?: boolean;
		optional?: boolean;
		persist?: boolean;
	}) {
		const interceptor = this.optGet(`/balena-cli/${version}`, {
			optional,
			persist,
		});
		if (notFound) {
			interceptor.reply(404, `version not found: ${version}`, jHeader);
		} else {
			interceptor.reply(200, { versionist: { publishedAt } }, jHeader);
		}
	}
}
