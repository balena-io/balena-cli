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

import * as Bluebird from 'bluebird';
import DockerToolbelt = require('docker-toolbelt');

export interface BuildDockerOptions {
	ca?: string; // path to ca (Certificate Authority) file (TLS)
	cert?: string; // path to cert (Certificate) file (TLS)
	key?: string; // path to key file (TLS)
	docker?: string; // dockerode DockerOptions.socketPath
	dockerHost?: string; // dockerode DockerOptions.host
	dockerPort?: number; // dockerode DockerOptions.port
	host?: string;
	port?: number;
	timeout?: number;
}

export function getDocker(
	options: BuildDockerOptions,
): Bluebird<DockerToolbelt>;

export function createClient(options: BuildDockerOptions): DockerToolbelt;
