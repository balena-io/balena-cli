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
import * as path from 'path';
import { Readable } from 'stream';

import type { ScopeOpts } from './nock-mock';
import { NockMock } from './nock-mock';

export const dockerResponsePath = path.normalize(
	path.join(import.meta.dirname, '..', 'test-data', 'docker-response'),
);

export class SupervisorMock extends NockMock {
	constructor() {
		super(/1\.2\.3\.4:48484/);
	}

	public expectGetPing(opts: ScopeOpts = {}) {
		this.optGet('/ping', opts).reply(200, 'OK');
	}

	public expectGetLogs(opts: ScopeOpts = {}) {
		const chunks = [
			'\n',
			'{"message":"Streaming logs","isSystem":true}\n',
			'{"serviceName":"bar","serviceId":1,"imageId":1,"isStdout":true,"timestamp":1591991625223,"message":"bar 8 (332) Linux 4e3f81149d71 4.19.75 #1 SMP PREEMPT Mon Mar 23 11:50:49 UTC 2020 aarch64 GNU/Linux"}\n',
			'{"serviceName":"foo","serviceId":2,"imageId":2,"isStdout":true,"timestamp":1591991628757,"message":"foo 8 (200) Linux cc5df60d89ee 4.19.75 #1 SMP PREEMPT Mon Mar 23 11:50:49 UTC 2020 aarch64 GNU/Linux"}\n',
		];
		let chunkCount = 0;
		const chunkedStream = new Readable({
			read(_size) {
				setTimeout(() => {
					this.push(chunkCount === chunks.length ? null : chunks[chunkCount++]);
				}, 10);
			},
		});
		this.optGet('/v2/local/logs', opts).reply((_uri, _reqBody, cb) => {
			cb(null, [200, chunkedStream]);
		});
	}
}
