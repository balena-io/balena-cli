/*
Copyright 2016-2017 Resin.io

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

import errors = require('resin-cli-errors');
import patterns = require('./utils/patterns');
import Promise = require('bluebird');
import { core as analytics } from 'analytics.node';
import { sentryIntegrations as Raven } from 'analytics.node';
import sentryDsn from './config';
import version from '../package.json';
const ravenOptions = {
	config: sentryDsn,
	release: version,
	captureUnhandledRejections: true,
	disableConsoleAlerts: true,
};
analytics.addIntegration(Raven);
analytics.initialize({ Sentry: ravenOptions });
analytics.setContext(
	analytics.anonymize({
		extra: {
			args: process.argv,
			node_version: process.version,
		},
	}),
);

exports.handle = function(error: any) {
	let message = errors.interpret(error);
	if (message == null) {
		return;
	}

	if (process.env.DEBUG) {
		message = error.stack;
	}

	patterns.printErrorMessage(message);

	return new Promise((resolve, reject) => {
		resolve(analytics.captureException(error));
	})
		.timeout(1000)
		.catch(function() {
			// Ignore any errors (from error logging, or timeouts)
		})
		.finally(() => process.exit(error.exitCode || 1));
};
