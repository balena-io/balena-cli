/**
 * @license
 * Copyright 2019-2021 Balena Ltd.
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

import { Flags } from '@oclif/core';
import { stripIndent } from './lazy.js';
import { lowercaseIfSlug } from './normalization.js';

type StringFlagOptions = NonNullable<Parameters<(typeof Flags)['string']>[0]>;
type BooleanFlagOptions = NonNullable<Parameters<(typeof Flags)['boolean']>[0]>;

type StringFlagProps = Partial<
	Pick<StringFlagOptions, 'exclusive' | 'description' | 'required' | 'char'>
>;
type BooleanFlagProps = Partial<
	Pick<BooleanFlagOptions, 'exclusive' | 'description' | 'char'>
>;

export const fleet = (props: StringFlagProps = {}) =>
	Flags.string({
		char: 'f',
		description: 'fleet name or slug (preferred)',
		parse: lowercaseIfSlug,
		...props,
	});

export const device = (props: StringFlagProps = {}) =>
	Flags.string({
		char: 'd',
		description: 'device UUID',
		...props,
	});

export const quiet = (props: BooleanFlagProps = {}) =>
	Flags.boolean({
		char: 'q',
		description: 'suppress warning messages',
		default: false,
		...props,
	});

export const release = (props: StringFlagProps = {}) =>
	Flags.string({
		char: 'r',
		description: 'release id',
		...props,
	});

export const service = (props: StringFlagProps = {}) =>
	Flags.string({
		char: 's',
		description: 'service name',
		...props,
	});

export const verbose = (props: BooleanFlagProps = {}) =>
	Flags.boolean({
		char: 'v',
		description: 'produce verbose output',
		default: false,
		...props,
	});

export const yes = (props: BooleanFlagProps = {}) =>
	Flags.boolean({
		char: 'y',
		description: 'answer "yes" to all questions (non interactive use)',
		default: false,
		...props,
	});

export const force = (props: BooleanFlagProps = {}) =>
	Flags.boolean({
		char: 'f',
		description: 'force action if the update lock is set',
		default: false,
		...props,
	});

export const dev = (props: BooleanFlagProps = {}) =>
	Flags.boolean({
		description: 'Configure balenaOS to operate in development mode',
		default: false,
		...props,
	});

export const secureBoot = (props: BooleanFlagProps = {}) =>
	Flags.boolean({
		description:
			'Configure balenaOS installer to opt-in secure boot and disk encryption',
		default: false,
		...props,
	});

export const drive = (props: StringFlagProps = {}) =>
	Flags.string({
		char: 'd',
		description: stripIndent`
		the drive to write the image to, eg. \`/dev/sdb\` or \`/dev/mmcblk0\`.
		Careful with this as you can erase your hard drive.
		Check \`balena util available-drives\` for available options.
	`,
		...props,
	});

export const driveOrImg = (props: StringFlagProps = {}) =>
	Flags.string({
		char: 'd',
		description:
			'path to OS image file (e.g. balena.img) or block device (e.g. /dev/disk2)',
		...props,
	});

export const deviceType = (props: StringFlagProps = {}) =>
	Flags.string({
		description:
			'device type (Check available types with `balena device-type list`)',
		char: 't',
		required: true,
		...props,
	});
