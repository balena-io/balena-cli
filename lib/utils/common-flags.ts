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

import { flags } from '@oclif/command';
import { stripIndent } from './lazy';
import { lowercaseIfSlug } from './normalization';

import type { IBooleanFlag } from '@oclif/parser/lib/flags';
import type { DataOutputOptions, DataSetOutputOptions } from '../framework';

export const fleet = flags.string({
	char: 'f',
	description: 'fleet name, slug (preferred), or numeric ID (deprecated)',
	parse: lowercaseIfSlug,
});

export const device = flags.string({
	char: 'd',
	description: 'device UUID',
});

export const help: IBooleanFlag<void> = flags.help({ char: 'h' });

export const quiet: IBooleanFlag<boolean> = flags.boolean({
	char: 'q',
	description: 'suppress warning messages',
	default: false,
});

export const release = flags.string({
	char: 'r',
	description: 'release id',
});

export const service = flags.string({
	char: 's',
	description: 'service name',
});

export const verbose: IBooleanFlag<boolean> = flags.boolean({
	char: 'v',
	description: 'produce verbose output',
	default: false,
});

export const yes: IBooleanFlag<boolean> = flags.boolean({
	char: 'y',
	description: 'answer "yes" to all questions (non interactive use)',
	default: false,
});

export const force: IBooleanFlag<boolean> = flags.boolean({
	char: 'f',
	description: 'force action if the update lock is set',
	default: false,
});

export const dev: IBooleanFlag<boolean> = flags.boolean({
	description: 'Configure balenaOS to operate in development mode',
	default: false,
});

export const drive = flags.string({
	char: 'd',
	description: stripIndent`
		the drive to write the image to, eg. \`/dev/sdb\` or \`/dev/mmcblk0\`.
		Careful with this as you can erase your hard drive.
		Check \`balena util available-drives\` for available options.
	`,
});

export const driveOrImg = flags.string({
	char: 'd',
	description:
		'path to OS image file (e.g. balena.img) or block device (e.g. /dev/disk2)',
});

export const deviceType = flags.string({
	description:
		'device type (Check available types with `balena devices supported`)',
	char: 't',
	required: true,
});

export const json: IBooleanFlag<boolean> = flags.boolean({
	char: 'j',
	description: 'produce JSON output instead of tabular output',
	default: false,
});

export const dataOutputFlags: flags.Input<DataOutputOptions> = {
	fields: flags.string({
		description: 'only show provided fields (comma-separated)',
	}),
	json: flags.boolean({
		char: 'j',
		exclusive: ['no-truncate'],
		description: 'output in json format',
		default: false,
	}),
};

export const dataSetOutputFlags: flags.Input<DataOutputOptions> &
	flags.Input<DataSetOutputOptions> = {
	...dataOutputFlags,
	filter: flags.string({
		description:
			'filter results by substring matching of a given field, eg: --filter field=foo',
	}),
	'no-header': flags.boolean({
		exclusive: ['json'],
		description: 'hide table header from output',
		default: false,
	}),
	'no-truncate': flags.boolean({
		exclusive: ['json'],
		description: 'do not truncate output to fit screen',
		default: false,
	}),
	sort: flags.string({
		description: `field to sort by (prepend '-' for descending order)`,
	}),
};
