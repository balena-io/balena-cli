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

import { set as setEsVersion } from '@balena/es-version';
import { mkdtempDisposableSyncGraceful } from '../src/utils/gracefully-disposable-tmp';
// Set the desired es version for downstream modules that support it
setEsVersion('es2018');

// Disable Sentry.io error reporting while running test code
process.env.BALENARC_NO_SENTRY = '1';

// Force color output for consistent test behavior
process.env.FORCE_COLOR = '1';

// Disable deprecation checks while running test code
// Like the global `--unsupported` flag
process.env.BALENARC_UNSUPPORTED = '1';

// Reduce the api request retry limits to keep the tests fast.
process.env.BALENARCTEST_API_RETRY_MIN_DELAY_MS = '100';
process.env.BALENARCTEST_API_RETRY_MAX_DELAY_MS = '1000';
process.env.BALENARCTEST_API_RETRY_MAX_ATTEMPTS = '2';

const tmpDir = mkdtempDisposableSyncGraceful();
process.once('SIGINT', () => {
	tmpDir.remove();
	console.error(
		`[debug] tests/config-tests.ts: Cleaned up BALENARC_DATA_DIRECTORY="${process.env.BALENARC_DATA_DIRECTORY}" b/c of SIGINT`,
	);
});
// Use a temporary dir for tests data
process.env.BALENARC_DATA_DIRECTORY = tmpDir.path;
console.error(
	`[debug] tests/config-tests.ts: BALENARC_DATA_DIRECTORY="${process.env.BALENARC_DATA_DIRECTORY}"`,
);

import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 35; // it appears that 'nock' adds a bunch of listeners - bug?
// SL: Looks like it's not nock causing this, as have seen the problem triggered from help.spec,
//     which is not using nock.  Perhaps mocha/chai? (unlikely), or something in the CLI?

import { config as chaiCfg } from 'chai';
chaiCfg.showDiff = true;
// enable diff comparison of large objects / arrays
chaiCfg.truncateThreshold = 0;

export const MOCKTTP_PORT = 8765;
// Point API calls to the mockttp server
process.env.BALENARC_BALENA_URL = `localhost:${MOCKTTP_PORT}`;
// Point API calls to the mockttp server
process.env.BALENARC_API_URL = `http://localhost:${MOCKTTP_PORT}`;
// Point builder calls to the mockttp server (builder URL is constructed from balenaUrl + "builder." prefix, which breaks for localhost)
process.env.BALENARC_BUILDER_URL = `http://localhost:${MOCKTTP_PORT}`;
// Point supervisor API calls to the mockttp server (for local device tests)
process.env.BALENARC_SUPERVISOR_ADDRESS = `http://localhost:${MOCKTTP_PORT}/`;
// Point npm registry calls to the mockttp server (for deprecation checker tests)
process.env.BALENARC_NPM_REGISTRY = `http://localhost:${MOCKTTP_PORT}`;
