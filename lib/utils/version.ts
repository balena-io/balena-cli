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

let v13: boolean;
let v14: boolean;

/** Feature switch for the next major version of the CLI */
export function isV13(): boolean {
	if (v13 === undefined) {
		v13 = isVersionGTE('13.0.0');
	}
	return v13;
}

export function isV14(): boolean {
	if (v14 === undefined) {
		v14 = isVersionGTE('14.0.0');
	}
	return v14;
}
