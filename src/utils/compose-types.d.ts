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

import type {
	ImageModel,
	ReleaseModel,
} from '@balena/compose/dist/release/models';
import type { Composition, ImageDescriptor } from '@balena/compose/dist/parse/index.js';
import type { Pack } from 'tar-stream';

interface Image {
	context: string;
	tag: string;
}

export interface BuiltImage {
	logs: string;
	name: string;
	props: {
		dockerfile?: string;
		projectType?: string;
		size?: number;
		startTime?: Date;
		endTime?: Date;
	};
	serviceName: string;
}

export interface TaggedImage {
	localImage: import('dockerode').Image;
	serviceImage: import('@balena/compose/dist/release/models').ImageModel;
	serviceName: string;
	logs: string;
	props: BuiltImage.props;
	registry: string;
	repo: string;
}

export interface ComposeOpts {
	convertEol: boolean;
	dockerfilePath?: string;
	inlineLogs?: boolean;
	multiDockerignore: boolean;
	noParentCheck: boolean;
	projectName?: string;
	projectPath: string;
	isLocal?: boolean;
}

export interface ComposeCliFlags {
	emulated: boolean;
	dockerfile?: string;
	nologs: boolean;
	'multi-dockerignore': boolean;
	'noparent-check': boolean;
	'registry-secrets'?: RegistrySecrets;
	'noconvert-eol': boolean;
	projectName?: string;
}

export interface ComposeProject {
	path: string;
	name: string;
	composition: Composition;
	descriptors: ImageDescriptor[];
}

export interface Release {
	client: import('@balena/compose').release.Request['client'];
	release: Pick<
		ReleaseModel,
		| 'id'
		| 'status'
		| 'commit'
		| 'composition'
		| 'source'
		| 'is_final'
		| 'contract'
		| 'semver'
		| 'start_timestamp'
		| 'end_timestamp'
	>;
	serviceImages: Dictionary<
		Omit<ImageModel, 'created_at' | 'is_a_build_of__service'>
	>;
}

interface TarDirectoryOptions {
	composition?: Composition;
	convertEol?: boolean;
	multiDockerignore?: boolean;
	preFinalizeCallback?: (pack: Pack) => void | Promise<void>;
}
