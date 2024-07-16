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

import Bluebird = require('bluebird');
import * as path from 'path';
import * as zlib from 'zlib';

import { NockMock } from './nock-mock';

export const builderResponsePath = path.normalize(
	path.join(import.meta.dirname, '..', 'test-data', 'builder-response'),
);

export class BuilderMock extends NockMock {
	constructor() {
		super(/builder\.balena-cloud\.com/);
	}

	public expectPostBuild(opts: {
		optional?: boolean;
		persist?: boolean;
		responseBody: any;
		responseCode: number;
		checkURI: (uri: string) => Promise<void>;
		checkBuildRequestBody: (requestBody: string | Buffer) => Promise<void>;
	}) {
		this.optPost(/^\/v3\/build($|[(?])/, opts).reply(
			async function (uri, requestBody, callback) {
				let error: Error | null = null;
				try {
					await opts.checkURI(uri);
					if (typeof requestBody === 'string') {
						const gzipped = Buffer.from(requestBody, 'hex');
						const gunzipped = await Bluebird.fromCallback<Buffer>((cb) => {
							zlib.gunzip(gzipped, cb);
						});
						await opts.checkBuildRequestBody(gunzipped);
					} else {
						throw new Error(
							`unexpected requestBody type "${typeof requestBody}"`,
						);
					}
				} catch (err) {
					error = err;
				}
				callback(error, [opts.responseCode, opts.responseBody]);
			},
		);
	}
}
