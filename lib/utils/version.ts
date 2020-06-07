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
import { version } from '../../package.json';

export function isVersionGTE(v: string): boolean {
	return semver.gte(process.env.BALENA_CLI_VERSION_OVERRIDE || version, v);
}

let v12: boolean;

export function isV12(): boolean {
	if (v12 === undefined) {
		// This is the `Change-type: major` PR that will produce v12.0.0.
		// Enable the v12 feature switches and run all v12 tests.
		v12 = true; // v12 = isVersionGTE('12.0.0');
	}
	return v12;
}
