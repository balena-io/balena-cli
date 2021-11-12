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

import type { IBooleanFlag } from '@oclif/parser/lib/flags';
import { stripIndent } from './lazy';
import { lowercaseIfSlug } from './normalization';
import { isV13 } from './version';

export const v13: IBooleanFlag<boolean> = flags.boolean({
	description: stripIndent`\
		enable selected balena CLI v13 pre-release features, like the renaming
		from "application" to "fleet" in command output`,
	default: false,
});

export const application = flags.string({
	char: 'a',
	description: 'DEPRECATED alias for -f, --fleet',
	parse: lowercaseIfSlug,
});
// TODO: Consider remove second alias 'app' when we can, to simplify.
export const app = flags.string({
	description: 'DEPRECATED alias for -f, --fleet',
	parse: lowercaseIfSlug,
});
export const fleet = flags.string({
	char: 'f',
	description: isV13()
		? 'fleet name, slug (preferred), or numeric ID (deprecated)'
		: // avoid the '(deprecated)' remark in v12 while cf.application and
		  // cf.app are also described as deprecated, to avoid the impression
		  // that cf.fleet is deprecated as well.
		  'fleet name, slug (preferred), or numeric ID',
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

export const deviceTypeIgnored = flags.string({
	description: 'ignored - no longer required',
	char: 't',
	required: false,
	hidden: isV13(),
});

export const json: IBooleanFlag<boolean> = flags.boolean({
	char: 'j',
	description: 'produce JSON output instead of tabular output',
	default: false,
});
