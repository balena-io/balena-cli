/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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

/*
 * THIS MODULE SHOULD NOT IMPORT / REQUIRE ANYTHING AT THE GLOBAL LEVEL.
 * It is meant to contain elementary helper functions or classes that
 * can be used very early on during CLI startup, before anything else
 * like Sentry error reporting, preparser, oclif parser and the like.
 */
import { Module } from 'node:module';
const require = Module.createRequire(import.meta.url);

export class CliSettings {
	public readonly settings: any;
	constructor() {
		this.settings =
			require('balena-settings-client') as typeof import('balena-settings-client');
	}

	public get<T>(name: string): T {
		return this.settings.get(name);
	}

	/**
	 * Like settings.get(), but return `undefined` instead of throwing an
	 * error if the setting is not found / not defined.
	 */
	public getCatch<T>(name: string): T | undefined {
		try {
			return this.settings.get(name);
		} catch (err) {
			if (!/Setting not found/i.test(err.message)) {
				throw err;
			}
		}
	}
}

export function parseBoolEnvVar(varName: string): boolean {
	return !['0', 'no', 'false', '', undefined].includes(
		process.env[varName]?.toLowerCase(),
	);
}

export function normalizeEnvVar(varName: string) {
	process.env[varName] = parseBoolEnvVar(varName) ? '1' : '';
}

const bootstrapVars = [
	'BALENARC_NO_SENTRY',
	'BALENARC_NO_ANALYTICS',
	'BALENARC_OFFLINE_MODE',
	'BALENARC_UNSUPPORTED',
	'DEBUG',
];

export function normalizeEnvVars(varNames: string[] = bootstrapVars) {
	for (const varName of varNames) {
		normalizeEnvVar(varName);
	}
}

/**
 * Set the individual env vars implied by BALENARC_OFFLINE_MODE.
 */
export function setOfflineModeEnvVars() {
	if (process.env.BALENARC_OFFLINE_MODE) {
		process.env.BALENARC_UNSUPPORTED = '1';
		process.env.BALENARC_NO_SENTRY = '1';
		process.env.BALENARC_NO_ANALYTICS = '1';
	}
}

export interface CachedUsername {
	token: string;
	username: string;
}

let cachedUsername: CachedUsername | undefined;

/**
 * Return the parsed contents of the `~/.balena/cachedUsername` file. If the file
 * does not exist, create it with the details from the cloud. If not connected
 * to the internet, return undefined. This function is used by `src/events.ts`
 * (event tracking) and `src/utils/device/ssh.ts` and needs to gracefully handle
 * the scenario of not being connected to the internet.
 */
export async function getCachedUsername(): Promise<CachedUsername | undefined> {
	if (cachedUsername) {
		return cachedUsername;
	}
	const [{ getBalenaSdk }, { getStorage }, settings] = await Promise.all([
		import('./lazy.js'),
		import('balena-settings-storage'),
		import('balena-settings-client'),
	]);
	const dataDirectory = settings.get<string>('dataDirectory');
	const storage = getStorage({ dataDirectory });
	let token: string | undefined;
	try {
		token = (await storage.get('token')) as string | undefined;
	} catch {
		// ignore
	}
	if (!token) {
		// If we can't get a token then we can't get a username
		return;
	}
	try {
		const result = (await storage.get('cachedUsername')) as
			| CachedUsername
			| undefined;
		if (result && result.token === token && result.username) {
			cachedUsername = result;
			return cachedUsername;
		}
	} catch {
		// ignore
	}
	try {
		const { username } = await getBalenaSdk().auth.getUserInfo();
		if (username) {
			cachedUsername = { token, username };
			await storage.set('cachedUsername', cachedUsername);
		}
	} catch {
		// ignore (not connected to the internet?)
	}
	return cachedUsername;
}
