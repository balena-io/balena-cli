/**
 * @license
 * Copyright 2018-2019 Balena Ltd.
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

import Dockerode = require('dockerode');
import * as dockerode from 'dockerode';

export * from './docker-coffee';

interface BalenaEngineVersion extends dockerode.DockerVersion {
	Engine?: string;
}

export async function isBalenaEngine(docker: Dockerode): Promise<boolean> {
	// dockerVersion.Engine should equal 'balena-engine' for the current/latest
	// version of balenaEngine, but it was at one point (mis)spelt 'balaena':
	// https://github.com/balena-os/balena-engine/pull/32/files
	const dockerVersion = (await docker.version()) as BalenaEngineVersion;
	return !!(
		dockerVersion.Engine && dockerVersion.Engine.match(/balena|balaena/)
	);
}
