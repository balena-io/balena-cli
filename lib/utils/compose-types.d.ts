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

import type { Composition, ImageDescriptor } from '@balena/compose-parse';
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
	serviceImage: import('balena-release/build/models').ImageModel;
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
	nogitignore: boolean; // v13: delete this line
	noParentCheck: boolean;
	projectName: string;
	projectPath: string;
	isLocal?: boolean;
}

export interface ComposeCliFlags {
	emulated: boolean;
	dockerfile?: string;
	logs: boolean;
	nologs: boolean;
	gitignore?: boolean; // v13: delete this line
	nogitignore?: boolean; // v13: delete this line
	'multi-dockerignore': boolean;
	'noparent-check': boolean;
	'registry-secrets'?: RegistrySecrets;
	'convert-eol': boolean;
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
	client: ReturnType<typeof import('balena-release').createClient>;
	release: Pick<
		import('balena-release/build/models').ReleaseModel,
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
	serviceImages: Partial<import('balena-release/build/models').ImageModel>;
}

interface TarDirectoryOptions {
	composition?: Composition;
	convertEol?: boolean;
	multiDockerignore?: boolean;
	nogitignore: boolean; // v13: delete this line
	preFinalizeCallback?: (pack: Pack) => void | Promise<void>;
}
