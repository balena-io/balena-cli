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

import type { BalenaModel } from 'balena-sdk';
import type { Composition, ImageDescriptor } from '@balena/compose/dist/parse';
import type { Pack } from 'tar-stream';

interface Image {
	context: string;
	tag: string;
}

interface ImageProperties {
	dockerfile?: string;
	projectType?: string;
	size?: number;
	startTime?: Date;
	endTime?: Date;
}

export interface BuiltImage {
	logs: string;
	name: string;
	props: ImageProperties;
	serviceName: string;
}

type ServiceImage = Omit<
	BalenaModel['image']['Read'],
	'created_at' | 'is_a_build_of__service'
>;

export interface TaggedImage {
	localImage: import('dockerode').Image;
	serviceImage: ServiceImage;
	serviceName: string;
	logs: string;
	props: ImageProperties;
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
		BalenaModel['release']['Read'],
		| 'id'
		| 'status'
		| 'commit'
		| 'composition'
		| 'source'
		| 'is_final'
		| 'semver'
		| 'start_timestamp'
		| 'end_timestamp'
	> & {
		contract: Contract | null;
	};
	serviceImages: Dictionary<ServiceImage>;
}

// TODO: The balena contract model for release.contract is `{ [key: string]: JSON } | JSON[] | null`
// which appears to be incorrect, as a contract is represented as `{ [key: string]: any }`
// (more specifically, `{ type: string, [key: string]: any }`) when querying a release for its contract.
// @balena/contrato also defines a ContractObject as the type below, see:
// https://github.com/balena-io/contrato/blob/543e891249431aa98474e17fecc66617ab9ca8f3/lib/types.ts#L15-L17
export type Contract = {
	type: string;
	[key: string]: any;
};

interface TarDirectoryOptions {
	composition?: Composition;
	convertEol?: boolean;
	multiDockerignore?: boolean;
	preFinalizeCallback?: (pack: Pack) => void | Promise<void>;
}
