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

import { Composition, ImageDescriptor } from 'resin-compose-parse';
import { Pack } from 'tar-stream';

import Logger = require('./logger');

interface Image {
	context: string;
	tag: string;
}

export interface ComposeOpts {
	dockerfilePath?: string;
	inlineLogs?: boolean;
	noParentCheck: boolean;
	projectName: string;
	projectPath: string;
}

export interface ComposeProject {
	path: string;
	name: string;
	composition: Composition;
	descriptors: ImageDescriptor[];
}

interface TarDirectoryOptions {
	preFinalizeCallback?: (pack: Pack) => void;
	convertEol?: boolean;
}
