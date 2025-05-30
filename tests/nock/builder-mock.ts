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
import { NockMock } from './nock-mock';

export const builderResponsePath = path.normalize(
	path.join(__dirname, '..', 'test-data', 'builder-response'),
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
		checkURI: (uri: string) => Promise<void> | void;
		checkBuildRequestBody: (requestBody: string | Buffer) => Promise<void>;
	}) {
		this.optPost(/^\/v3\/build($|[(?])/, opts).reply(async function (
			request: Request,
		) {
			await opts.checkURI(request.url);
			const requestBody = await request.text();
			if (typeof requestBody !== 'string') {
				throw new Error(`unexpected requestBody type "${typeof requestBody}"`);
			}
			await opts.checkBuildRequestBody(requestBody);
			return [opts.responseCode, opts.responseBody];
		});
	}
}
