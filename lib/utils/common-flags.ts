/**
 * @license
 * Copyright 2019 Balena Ltd.
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

export const application = flags.string({
	char: 'a',
	description: 'application name',
});
// TODO: Consider remove second alias 'app' when we can, to simplify.
export const app = flags.string({
	description: "same as '--application'",
});

/**
 * "ArgFlag" refers to flags that are alternatives to positional arguments,
 * for example: `balena deploy 1234567` vs. `balena deploy --uuid 1234567`
 */
export function mkAppArgFlagCombo() {
	return {
		name: mkStrAppArgFlag('name'),
		uuid: mkStrAppArgFlag('uuid'),
		id: mkIntAppArgFlag('id'),
	};
}

export function mkAppFlagCombo() {
	return {
		app: mkStrAppFlag('app'),
		'app-name': mkStrAppFlag('app-name'),
		'app-uuid': mkStrAppFlag('app-uuid'),
		'app-id': mkIntAppFlag('app-id'),
		application: mkStrAppFlag('application'),
		'application-name': mkStrAppFlag('applicaton-name'),
		'application-uuid': mkStrAppFlag('applicaton-uuid'),
		'application-id': mkIntAppFlag('applicaton-id'),
	};
}

export const device = flags.string({
	char: 'd',
	description: 'device UUID',
});

/**
 * "ArgFlag" refers to flags that are alternatives to positional arguments,
 * for example: `device move 1234567` vs. `device move --uuid 1234567`
 */
export function mkDeviceArgFlagCombo(isCommaList: boolean) {
	return {
		uuid: mkStrDeviceArgFlag('uuid', isCommaList),
		id: mkStrDeviceArgFlag('id', isCommaList),
	};
}

export function mkDeviceFlagCombo() {
	return {
		device: mkStrDeviceFlag('device'),
		'device-uuid': mkStrDeviceFlag('device-uuid'),
		'device-id': mkIntDeviceFlag('device-id'),
	};
}

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
});

export const yes: IBooleanFlag<boolean> = flags.boolean({
	char: 'y',
	description: 'answer "yes" to all questions (non interactive use)',
});

export const force: IBooleanFlag<boolean> = flags.boolean({
	char: 'f',
	description: 'force action if the update lock is set',
});

export const drive = flags.string({
	char: 'd',
	description: stripIndent`
		the drive to write the image to, eg. \`/dev/sdb\` or \`/dev/mmcblk0\`.
		Careful with this as you can erase your hard drive.
		Check \`balena util available-drives\` for available options.
	`,
});

/** Check that exactly one of the given options or positional args are used. */
export async function checkExclusiveArgFlags(
	positionalArgs: { [name: string]: any },
	exclusiveOpts: { [name: string]: any },
) {
	const _ = await import('lodash');
	const { ExpectedError } = await import('../errors');
	const filter = (obj: { [name: string]: any }) =>
		_.transform<string, any>(obj, (newObj, value, key) => {
			if (value) {
				newObj[key] = value;
			}
		});
	const filteredArgs = filter(positionalArgs);
	const filteredOpts = filter(exclusiveOpts);
	const filteredPosKeys = Object.keys(filteredArgs);
	const filteredOptKeys = Object.keys(filteredOpts);
	if (filteredPosKeys.length && filteredOptKeys.length) {
		throw new ExpectedError(
			`The "${filteredPosKeys.join('" or "')}" positional argument${
				filteredPosKeys.length === 1 ? '' : 's'
			} cannot be used with the "--${filteredOptKeys.join('" or "--')}" option${
				filteredOptKeys.length === 1 ? '' : 's'
			}`,
		);
	}

	if (filteredPosKeys.length === 0 && filteredOptKeys.length === 0) {
		const posKeys = Object.keys(positionalArgs);
		const optKeys = Object.keys(exclusiveOpts);
		throw new ExpectedError(
			`At least one "${posKeys.join('" or "')}" positional argument${
				posKeys.length === 1 ? '' : 's'
			} or "--${optKeys.join('" or "--')}" option${
				optKeys.length === 1 ? '' : 's'
			} must be provided`,
		);
	}
}

function mkExclusive(
	names: string[],
	suffixes: string[],
	except: string[] = [],
): string[] {
	const exclusiveFlags: string[] = [];
	for (const name of names) {
		for (const suffix of suffixes) {
			const flag = name && suffix ? `${name}-${suffix}` : name || suffix;
			if (!except.includes(flag)) {
				exclusiveFlags.push(flag);
			}
		}
	}
	return exclusiveFlags;
}

function mkAppFlagOpts(name: string) {
	const [prefix, suffix] = name.split('-');
	const description =
		prefix === 'app'
			? `alias for --${name.replace('app', 'application')}`
			: suffix === 'id'
			? 'application numeric database ID'
			: suffix === 'uuid'
			? 'application UUID'
			: suffix === 'name'
			? 'application name'
			: 'application name, UUID or numeric database ID';
	return {
		description,
		exclusive: mkExclusive(
			['app', 'application'],
			['', 'name', 'uuid', 'id'],
			[name],
		),
		hidden: false, // name.includes('-'),
	};
}

function mkAppArgFlagOpts(name: string) {
	return {
		description: `application ${
			['uuid', 'id'].includes(name) ? name.toUpperCase() : name
		} (alternative to positional argument)`,
		exclusive: mkExclusive([''], ['name', 'uuid', 'id'], [name]),
		hidden: false,
	};
}

function mkStrAppFlag(name: string) {
	return flags.string(mkAppFlagOpts(name));
}

function mkIntAppFlag(name: string) {
	return flags.integer(mkAppFlagOpts(name));
}

function mkStrAppArgFlag(name: string) {
	return flags.string(mkAppArgFlagOpts(name));
}

function mkIntAppArgFlag(name: string) {
	return flags.integer(mkAppArgFlagOpts(name));
}

function mkDeviceFlagOpts(name: string) {
	return {
		description: `device ${name}`,
		exclusive: mkExclusive(['device'], ['', 'uuid', 'id'], [name]),
		hidden: name.includes('-'),
	};
}

function mkDeviceArgFlagOpts(name: string, isCommaList: boolean) {
	const descriptionParts: string[] = [];
	descriptionParts.push(isCommaList ? 'comma-separated list of ' : '');
	descriptionParts.push(
		name === 'id'
			? 'numeric device database ID'
			: name === 'uuid'
			? 'device UUID'
			: `device ${name}`,
	);
	descriptionParts.push(isCommaList ? 's' : '');
	return {
		description: descriptionParts.join(''),
		exclusive: mkExclusive([''], ['uuid', 'id'], [name]),
		hidden: false,
	};
}

function mkIntDeviceFlag(name: string) {
	return flags.integer(mkDeviceFlagOpts(name));
}

function mkStrDeviceFlag(name: string) {
	return flags.string(mkDeviceFlagOpts(name));
}

function mkStrDeviceArgFlag(name: string, isCommaList: boolean) {
	return flags.string(mkDeviceArgFlagOpts(name, isCommaList));
}
