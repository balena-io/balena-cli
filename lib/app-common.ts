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

/**
 * Sentry.io setup
 * @see https://docs.sentry.io/clients/node/
 */
function setupRaven() {
	const Raven = require('raven');
	Raven.disableConsoleAlerts();
	Raven.config(require('./config').sentryDsn, {
		captureUnhandledRejections: true,
		autoBreadcrumbs: true,
		release: require('../package.json').version,
	}).install(function(_logged: any, error: Error) {
		console.error(error);
		return process.exit(1);
	});

	Raven.setContext({
		extra: {
			args: process.argv,
			node_version: process.version,
		},
	});
}

function checkNodeVersion() {
	const validNodeVersions = require('../package.json').engines.node;
	if (!require('semver').satisfies(process.version, validNodeVersions)) {
		const { stripIndent } = require('common-tags');
		console.warn(stripIndent`
			------------------------------------------------------------------------------
			Warning: Node version "${
				process.version
			}" does not match required versions "${validNodeVersions}".
			This may cause unexpected behaviour. To upgrade Node, visit:
			https://nodejs.org/en/download/
			------------------------------------------------------------------------------
			`);
	}
}

function setupGlobalHttpProxy() {
	// Doing this before requiring any other modules,
	// including the 'balena-sdk', to prevent any module from reading the http proxy config
	// before us
	const globalTunnel = require('global-tunnel-ng');
	const settings = require('balena-settings-client');
	let proxy;
	try {
		proxy = settings.get('proxy') || null;
	} catch (error1) {
		proxy = null;
	}

	// Init the tunnel even if the proxy is not configured
	// because it can also get the proxy from the http(s)_proxy env var
	// If that is not set as well the initialize will do nothing
	globalTunnel.initialize(proxy);

	// TODO: make this a feature of capitano https://github.com/balena-io/capitano/issues/48
	(global as any).PROXY_CONFIG = globalTunnel.proxyConfig;
}

function setupBalenaSdkSharedOptions() {
	// We don't yet use balena-sdk directly everywhere, but we set up shared
	// options correctly so we can do safely in submodules
	const BalenaSdk = require('balena-sdk');
	const settings = require('balena-settings-client');
	BalenaSdk.setSharedOptions({
		apiUrl: settings.get('apiUrl'),
		imageMakerUrl: settings.get('imageMakerUrl'),
		dataDirectory: settings.get('dataDirectory'),
		retries: 2,
	});
}

let BluebirdConfigured = false;

/**
 * Configure Bluebird and assign it as the global promise library.
 * Modules like `stream-to-promise` will otherwise produce native promises,
 * which leads to errors as much of the CLI CoffeeScript code expects Bluebird
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

export function globalInit() {
	setupRaven();
	checkNodeVersion();
	configureBluebird();
	setupGlobalHttpProxy();
	setupBalenaSdkSharedOptions();

	// check for CLI updates once a day
	require('./utils/update').notify();
}
