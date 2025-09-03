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
import { stripIndent } from './lazy';
import { lowercaseIfSlug } from './normalization';
import type { FlagProps } from '@oclif/core/lib/interfaces/parser';

export const fleet = Flags.string({
	char: 'f',
	description: 'fleet name or slug (preferred)',
	parse: lowercaseIfSlug,
});

export const device = Flags.string({
	char: 'd',
	description: 'device UUID',
});

export const quiet = Flags.boolean({
	char: 'q',
	description: 'suppress warning messages',
	default: false,
});

export const release = Flags.string({
	char: 'r',
	description: 'release id',
});

export const service = Flags.string({
	char: 's',
	description: 'service name',
});

export const verbose = Flags.boolean({
	char: 'v',
	description: 'produce verbose output',
	default: false,
});

export const yes = Flags.boolean({
	char: 'y',
	description: 'answer "yes" to all questions (non interactive use)',
	default: false,
});

export const force = Flags.boolean({
	char: 'f',
	description: 'force action if the update lock is set',
	default: false,
});

export const dev = Flags.boolean({
	description: 'Configure balenaOS to operate in development mode',
	default: false,
});

export const secureBoot = Flags.boolean({
	description:
		'Configure balenaOS installer to opt-in secure boot and disk encryption',
	default: false,
});

export const drive = Flags.string({
	char: 'd',
	description: stripIndent`
		the drive to write the image to, eg. \`/dev/sdb\` or \`/dev/mmcblk0\`.
		Careful with this as you can erase your hard drive.
		Check \`balena util available-drives\` for available options.
	`,
});

export const driveOrImg = Flags.string({
	char: 'd',
	description:
		'path to OS image file (e.g. balena.img) or block device (e.g. /dev/disk2)',
});

export const deviceType = Flags.string({
	description:
		'device type (Check available types with `balena device-type list`)',
	char: 't',
	required: true,
});

export const setupCustomFlagOptions = <T extends Record<string, FlagProps>>(
	flags: T,
): T => {
	for (const [flagName, flagValue] of Object.entries(flags)) {
		if (
			'$compatibleOnlyWith' in flagValue &&
			flagValue.$compatibleOnlyWith != null
		) {
			if (flagValue.exclusive != null) {
				throw new Error('Cannot combine $compatibleOnlyWith with exclusive');
			}
			if (!Array.isArray(flagValue.$compatibleOnlyWith)) {
				throw new Error(
					`Found non-array $compatibleOnlyWith option on flag ${flagName}`,
				);
			}
			if (flagValue.$compatibleOnlyWith.length === 0) {
				throw new Error(
					`Found empty $compatibleOnlyWith option on flag ${flagName}`,
				);
			}
			const invalidEntry = flagValue.$compatibleOnlyWith.find(
				(x) => typeof x !== 'string' || !(x in flags),
			);
			if (invalidEntry != null) {
				throw new Error(
					`Found invalid $compatibleOnlyWith entry '${invalidEntry}' on flag ${flagName}`,
				);
			}
			const compatibleOnlyWith = new Set(flagValue.$compatibleOnlyWith);
			// flags can't be incompatible with themselves
			compatibleOnlyWith.add(flagName);
			flagValue.exclusive = Object.keys(flags).filter(
				(flagKey) => !compatibleOnlyWith.has(flagKey),
			);
			delete flagValue.$compatibleOnlyWith;
		}
	}
	return flags;
};
