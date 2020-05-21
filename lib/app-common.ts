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

import * as packageJSON from '../package.json';
import { onceAsync } from './utils/lazy';

class CliSettings {
	public readonly settings: any;
	constructor() {
		this.settings = require('balena-settings-client') as typeof import('balena-settings-client');
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

/**
 * Sentry.io setup
 * @see https://docs.sentry.io/error-reporting/quickstart/?platform=node
 */
export const setupSentry = onceAsync(async () => {
	const config = await import('./config');
	const Sentry = await import('@sentry/node');
	Sentry.init({
		dsn: config.sentryDsn,
		release: packageJSON.version,
	});
	Sentry.configureScope(scope => {
		scope.setExtras({
			is_pkg: !!(process as any).pkg,
			node_version: process.version,
			platform: process.platform,
		});
	});
	return Sentry.getCurrentHub();
});

function checkNodeVersion() {
	const validNodeVersions = packageJSON.engines.node;
	if (!require('semver').satisfies(process.version, validNodeVersions)) {
		const { stripIndent } = require('common-tags');
		console.warn(stripIndent`
			------------------------------------------------------------------------------
			Warning: Node version "${process.version}" does not match required versions "${validNodeVersions}".
			This may cause unexpected behavior. To upgrade Node, visit:
			https://nodejs.org/en/download/
			------------------------------------------------------------------------------
			`);
	}
}

export type GlobalTunnelNgConfig = import('global-tunnel-ng').Options;

type ProxyConfig = string | GlobalTunnelNgConfig;

/**
 * Global proxy setup. Originally, `global-tunnel-ng` was used, but it only
 * supports Node.js versions older than 10.16.0. For v10.16.0 and later,
 * we use `global-agent` (which only supports Node.js v10.0.0 and later).
 *
 * For backwards compatibility reasons, in either case we still accept a
 * 'proxy' setting in `.balenarc.yml` that follows the
 * `global-tunnel-ng` object configuration format:
 *     https://www.npmjs.com/package/global-tunnel-ng#options
 *
 * The proxy may also be configured with the environment variables:
 * BALENARC_PROXY, HTTP_PROXY, HTTPS_PROXY, http_proxy, and https_proxy,
 * any of which should contain a URL in the usual format (authentication
 * details are optional): http://username:password@domain.com:1234
 *
 * A proxy exclusion list in the NO_PROXY variable is only supported when
 * `global-agent` is used, i.e. with Node.js v10.16.0 or later. The format
 * is specified at: https://www.npmjs.com/package/global-agent#exclude-urls
 * Patterns are matched with matcher: https://www.npmjs.com/package/matcher
 * 'localhost' and '127.0.0.1' are always excluded. If NO_PROXY is not defined,
 * default exclusion patterns are added for all private IPv4 address ranges.
 */
async function setupGlobalHttpProxy(settings: CliSettings) {
	// `global-tunnel-ng` accepts lowercase variables with higher precedence
	// than uppercase variables, but `global-agent` does not accept lowercase.
	// Set uppercase versions for backwards compatibility.
	const { env } = process;
	if (env.http_proxy) {
		env.HTTP_PROXY = env.http_proxy;
	}
	if (env.https_proxy) {
		env.HTTPS_PROXY = env.https_proxy;
	}
	delete env.http_proxy;
	delete env.https_proxy;

	const proxy = settings.getCatch<ProxyConfig>('proxy');
	if (proxy || env.HTTPS_PROXY || env.HTTP_PROXY) {
		const semver = await import('semver');
		if (semver.lt(process.version, '10.16.0')) {
			await setupGlobalTunnelNgProxy(proxy);
		} else {
			// use global-agent instead of global-tunnel-ng
			await setupGlobalAgentProxy(settings, proxy);
		}
	}
}

/**
 * `global-tunnel-ng` proxy setup.
 * See docs for setupGlobalHttpProxy() above.
 */
async function setupGlobalTunnelNgProxy(proxy?: ProxyConfig) {
	const globalTunnel = await import('global-tunnel-ng');
	// Init the tunnel even if BALENARC_PROXY is not defined, because
	// other env vars may be defined. If no proxy configuration exists,
	// initialize() does nothing.
	globalTunnel.initialize(proxy);
	(global as any).PROXY_CONFIG = globalTunnel.proxyConfig;
}

/**
 * `global-agent` proxy setup.
 * See docs for setupGlobalHttpProxy() above, and also the README file
 * (Proxy Support section).
 * If `proxy` is undefined, HTTP(S)_PROXY env vars are expected to be set.
 */
async function setupGlobalAgentProxy(
	settings: CliSettings,
	proxy?: ProxyConfig,
) {
	const noProxy = settings.getCatch<string>('noProxy');
	// Always exclude localhost, even if NO_PROXY is set
	const requiredNoProxy = ['localhost', '127.0.0.1'];
	// Private IPv4 address patterns in `matcher` format: https://www.npmjs.com/package/matcher
	const privateNoProxy = ['*.local', '10.*', '192.168.*'];
	for (let i = 16; i <= 31; i++) {
		privateNoProxy.push(`172.${i}.*`);
	}

	const env = process.env;
	env.GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE = '';
	env.NO_PROXY = [
		...requiredNoProxy,
		...(noProxy ? noProxy.split(',').filter(v => v) : privateNoProxy),
	].join(',');

	if (proxy) {
		const proxyUrl: string =
			typeof proxy === 'string' ? proxy : makeUrlFromTunnelNgConfig(proxy);

		env.HTTPS_PROXY = env.HTTP_PROXY = proxyUrl;
	}

	const { bootstrap } = await import('global-agent');
	bootstrap();
}

/** Make a URL in the format 'http://bob:secret@proxy.company.com:12345' */
export function makeUrlFromTunnelNgConfig(cfg: GlobalTunnelNgConfig): string {
	let url: string = cfg.host;
	if (cfg.proxyAuth) {
		url = `${cfg.proxyAuth}@${url}`;
	}
	if (cfg.protocol) {
		// accept 'http', 'http:', 'http://' and the like
		const match = cfg.protocol.match(/^[^:/]+/);
		if (match) {
			url = `${match[0].toLowerCase()}://${url}`;
		}
	}
	if (cfg.port) {
		url = `${url}:${cfg.port}`;
	}
	return url;
}

function setupBalenaSdkSharedOptions(settings: CliSettings) {
	// We don't yet use balena-sdk directly everywhere, but we set up shared
	// options correctly so we can do safely in submodules
	const BalenaSdk = require('balena-sdk');
	BalenaSdk.setSharedOptions({
		apiUrl: settings.get<string>('apiUrl'),
		imageMakerUrl: settings.get<string>('imageMakerUrl'),
		dataDirectory: settings.get<string>('dataDirectory'),
		retries: 2,
	});
}

let BluebirdConfigured = false;

/**
 * Configure Bluebird and assign it as the global promise library.
 * Modules like `stream-to-promise` will otherwise produce native promises,
 * which leads to errors as much of the CLI JavaScript code expects Bluebird
 * promises.
 */
export function configureBluebird() {
	if (BluebirdConfigured) {
		return;
	}
	BluebirdConfigured = true;
	const Bluebird = require('bluebird');
	Bluebird.config({
		longStackTraces: process.env.DEBUG ? true : false,
	});
	if (!(global as any)['@@any-promise/REGISTRATION']) {
		require('any-promise/register/bluebird');
	}
}

/**
 * Addresses the console warning:
 * (node:49500) MaxListenersExceededWarning: Possible EventEmitter memory
 * leak detected. 11 error listeners added. Use emitter.setMaxListeners() to
 * increase limit
 */
export function setMaxListeners(maxListeners: number) {
	require('events').EventEmitter.defaultMaxListeners = maxListeners;
}

export async function globalInit() {
	await setupSentry();
	checkNodeVersion();
	configureBluebird();

	const settings = new CliSettings();

	// Proxy setup should be done early on, before loading balena-sdk
	await setupGlobalHttpProxy(settings);
	setupBalenaSdkSharedOptions(settings);

	// check for CLI updates once a day
	require('./utils/update').notify();
}
