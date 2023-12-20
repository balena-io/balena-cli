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

export const fleet = Flags.string({
	char: 'f',
	description: 'fleet name or slug (preferred)',
	parse: lowercaseIfSlug,
});

export const device = Flags.string({
	char: 'd',
	description: 'device UUID',
});

export const help = Flags.help({ char: 'h' });

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
		'device type (Check available types with `balena devices supported`)',
	char: 't',
	required: true,
});

export const json = Flags.boolean({
	char: 'j',
	description: 'produce JSON output instead of tabular output',
	default: false,
});

export const dataOutputFlags = {
	fields: Flags.string({
		description: 'only show provided fields (comma-separated)',
	}),
	json: Flags.boolean({
		char: 'j',
		exclusive: ['no-truncate'],
		description: 'output in json format',
		default: false,
	}),
};

export const dataSetOutputFlags = {
	...dataOutputFlags,
	filter: Flags.string({
		description:
			'filter results by substring matching of a given field, eg: --filter field=foo',
	}),
	'no-header': Flags.boolean({
		exclusive: ['json'],
		description: 'hide table header from output',
		default: false,
	}),
	'no-truncate': Flags.boolean({
		exclusive: ['json'],
		description: 'do not truncate output to fit screen',
		default: false,
	}),
	sort: Flags.string({
		description: `field to sort by (prepend '-' for descending order)`,
	}),
};
