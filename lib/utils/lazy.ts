/* eslint-disable no-restricted-imports */
/** the import blacklist is to enforce lazy loading so exempt this file  */
/*
Copyright 2020 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type * as BalenaSdk from 'balena-sdk';
import type { Chalk } from 'chalk';
import type * as visuals from 'resin-cli-visuals';
import type * as CliForm from 'resin-cli-form';
import type { ux } from '@oclif/core';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Equivalent of _.once but avoiding the need to import lodash for lazy deps
const once = <T>(fn: () => T) => {
	let cached: T;
	return (): T => {
		if (!cached) {
			cached = fn();
		}
		return cached;
	};
};

export const onceAsync = <T>(fn: () => Promise<T>) => {
	let cached: T;
	return async (): Promise<T> => {
		if (!cached) {
			cached = await fn();
		}
		return cached;
	};
};

export const getBalenaSdk = once(() =>
	(require('balena-sdk') as typeof BalenaSdk).fromSharedOptions(),
);

export const getVisuals = once(
	() => require('resin-cli-visuals') as typeof visuals,
);

export const getChalk = once(() => require('chalk') as Chalk);

export const getCliForm = once(
	() => require('resin-cli-form') as typeof CliForm,
);

export const getCliUx = once(
	() => require('@oclif/core/lib/cli-ux') as typeof ux,
);

// Directly export stripIndent as we always use it immediately, but importing just `stripIndent` reduces startup time
export const stripIndent =
	// tslint:disable-next-line:no-var-requires
	require('common-tags/lib/stripIndent') as typeof import('common-tags/lib/stripIndent');
