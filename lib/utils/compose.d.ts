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

import * as Bluebird from 'bluebird';
import { Composition } from 'resin-compose-parse';
import * as Stream from 'stream';
import { Pack } from 'tar-stream';

import Logger = require('./logger');

interface Image {
	context: string;
	tag: string;
}

interface Descriptor {
	image: Image | string;
	serviceName: string;
}

export function resolveProject(projectRoot: string): Bluebird<string>;

export interface ComposeProject {
	path: string;
	name: string;
	composition: Composition;
	descriptors: Descriptor[];
}

export function loadProject(
	logger: Logger,
	projectPath: string,
	projectName: string,
	image?: string,
	dockerfilePath?: string,
): Bluebird<ComposeProject>;

interface TarDirectoryOptions {
	preFinalizeCallback?: (pack: Pack) => void;
	convertEol?: boolean;
}

export function tarDirectory(
	source: string,
	options?: TarDirectoryOptions,
): Promise<Stream.Readable>;
