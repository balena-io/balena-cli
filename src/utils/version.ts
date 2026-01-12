/**
 * @license
 * Copyright 2018-2020 Balena Ltd.
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

import * as semver from 'semver';
import { Module } from 'node:module';
const require = Module.createRequire(import.meta.url);
const { version } =
	require('../../package.json') as typeof import('../../package.json');

export function isVersionGTE(v: string): boolean {
	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	return semver.gte(process.env.BALENA_CLI_VERSION_OVERRIDE || version, v);
}
