/*
Copyright 2016-2020 Balena

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

import * as _ from 'lodash';
import { getBalenaSdk, getVisuals, getCliForm } from '../utils/lazy';
import * as dockerUtils from '../utils/docker';

const isCurrent = (commit) => commit === 'latest' || commit === 'current';

/** @type {any} */
const applicationExpandOptions = {
	owns__release: {
		$select: ['id', 'commit', 'end_timestamp', 'composition'],
		$orderby: [{ end_timestamp: 'desc' }, { id: 'desc' }],
		$expand: {
			contains__image: {
				$select: ['image'],
				$expand: {
					image: {
						$select: ['image_size', 'is_stored_at__image_location'],
					},
				},
			},
		},
		$filter: {
			status: 'success',
		},
	},
};

let allDeviceTypes;
const getDeviceTypes = async function () {
	if (allDeviceTypes !== undefined) {
		return allDeviceTypes;
	}
	const balena = getBalenaSdk();
	return balena.models.config
		.getDeviceTypes()
		.then((deviceTypes) => _.sortBy(deviceTypes, 'name'))
		.tap((dt) => {
			allDeviceTypes = dt;
		});
};

const getDeviceTypesWithSameArch = function (deviceTypeSlug) {
	return getDeviceTypes().then(function (deviceTypes) {
		const deviceType = _.find(deviceTypes, { slug: deviceTypeSlug });
		if (!deviceType) {
			throw new Error(`Device type "${deviceTypeSlug}" not found in API query`);
		}
		return _(deviceTypes).filter({ arch: deviceType.arch }).map('slug').value();
	});
};

const getApplicationsWithSuccessfulBuilds = function (deviceType) {
	const balena = getBalenaSdk();

	return getDeviceTypesWithSameArch(deviceType).then((deviceTypes) => {
		/** @type {import('balena-sdk').PineOptionsFor<import('balena-sdk').Application>} */
		const options = {
			$filter: {
				device_type: {
					$in: deviceTypes,
				},
				owns__release: {
					$any: {
						$alias: 'r',
						$expr: {
							r: {
								status: 'success',
							},
						},
					},
				},
			},
			$expand: applicationExpandOptions,
			$select: [
				'id',
				'app_name',
				'device_type',
				'commit',
				'should_track_latest_release',
			],
			$orderby: 'app_name asc',
		};
		return balena.pine.get({
			resource: 'my_application',
			options,
		});
	});
};

const selectApplication = function (deviceType) {
	const visuals = getVisuals();
	const { exitWithExpectedError } = require('../errors');

	const applicationInfoSpinner = new visuals.Spinner(
		'Downloading list of applications and releases.',
	);
	applicationInfoSpinner.start();

	return getApplicationsWithSuccessfulBuilds(deviceType).then(function (
		applications,
	) {
		applicationInfoSpinner.stop();
		if (applications.length === 0) {
			exitWithExpectedError(
				`You have no apps with successful releases for a '${deviceType}' device type.`,
			);
		}
		return getCliForm().ask({
			message: 'Select an application',
			type: 'list',
			choices: applications.map((app) => ({
				name: app.app_name,
				value: app,
			})),
		});
	});
};

const selectApplicationCommit = function (releases) {
	const { exitWithExpectedError } = require('../errors');

	if (releases.length === 0) {
		exitWithExpectedError('This application has no successful releases.');
	}
	const DEFAULT_CHOICE = { name: 'current', value: 'current' };
	const choices = [DEFAULT_CHOICE].concat(
		releases.map((release) => ({
			name: `${release.end_timestamp} - ${release.commit}`,
			value: release.commit,
		})),
	);
	return getCliForm().ask({
		message: 'Select a release',
		type: 'list',
		default: 'current',
		choices,
	});
};

const offerToDisableAutomaticUpdates = async function (
	application,
	commit,
	pinDevice,
) {
	const balena = getBalenaSdk();

	if (
		isCurrent(commit) ||
		!application.should_track_latest_release ||
		pinDevice
	) {
		return;
	}
	const message = `\

This application is set to track the latest release, and non-pinned devices
are automatically updated when a new release is available. This may lead to
unexpected behavior: The preloaded device will download and install the latest
release once it is online.

This prompt gives you the opportunity to disable automatic updates for this
application now. Note that this would result in the application being pinned
to the current latest release, rather than some other release that may have
been selected for preloading. The pinned released may be further managed
through the web dashboard or programatically through the balena API / SDK.
Documentation about release policies and app/device pinning can be found at:
https://www.balena.io/docs/learn/deploy/release-strategy/release-policy/

Alternatively, the --pin-device-to-release flag may be used to pin only the
preloaded device to the selected release.

Would you like to disable automatic updates for this application now?\
`;
	return getCliForm()
		.ask({
			message,
			type: 'confirm',
		})
		.then(function (update) {
			if (!update) {
				return;
			}
			return balena.pine.patch({
				resource: 'application',
				id: application.id,
				body: {
					should_track_latest_release: false,
				},
			});
		});
};

/**
 * @param {import('balena-sdk').BalenaSDK} balenaSdk
 * @param {string | number} appId
 * @returns {Promise<import('balena-sdk').Application>}
 */
async function getAppWithReleases(balenaSdk, appId) {
	return balenaSdk.models.application.get(appId, {
		$expand: applicationExpandOptions,
	});
}

async function prepareAndPreload(preloader, balenaSdk, options) {
	const { ExpectedError } = require('../errors');

	await preloader.prepare();

	const application = options.appId
		? await getAppWithReleases(balenaSdk, options.appId)
		: await selectApplication(preloader.config.deviceType);

	/** @type {string} commit hash or the strings 'latest' or 'current' */
	let commit;

	// Use the commit given as --commit or show an interactive commit selection menu
	if (options.commit) {
		if (isCurrent(options.commit)) {
			if (!application.commit) {
				throw new Error(
					`Unexpected empty commit hash for app ID "${application.id}"`,
				);
			}
			// handle `--commit current` (and its `--commit latest` synonym)
			commit = 'latest';
		} else {
			const release = _.find(application.owns__release, (r) =>
				r.commit.startsWith(options.commit),
			);
			if (!release) {
				throw new ExpectedError(
					`There is no release matching commit "${options.commit}"`,
				);
			}
			commit = release.commit;
		}
	} else {
		// this could have the value 'current'
		commit = await selectApplicationCommit(application.owns__release);
	}

	await preloader.setAppIdAndCommit(
		application.id,
		isCurrent(commit) ? application.commit : commit,
	);

	// Propose to disable automatic app updates if the commit is not the current release
	await offerToDisableAutomaticUpdates(application, commit, options.pinDevice);

	// All options are ready: preload the image.
	await preloader.preload();
}

const preloadOptions = dockerUtils.appendConnectionOptions([
	{
		signature: 'app',
		parameter: 'appId',
		description: 'Name, slug or numeric ID of the application to preload',
		alias: 'a',
	},
	{
		signature: 'commit',
		parameter: 'hash',
		description: `\
The commit hash for a specific application release to preload, use "current" to specify the current
release (ignored if no appId is given). The current release is usually also the latest, but can be
manually pinned using https://github.com/balena-io-projects/staged-releases .\
`,
		alias: 'c',
	},
	{
		signature: 'splash-image',
		parameter: 'splashImage.png',
		description: 'path to a png image to replace the splash screen',
		alias: 's',
	},
	{
		signature: 'dont-check-arch',
		boolean: true,
		description:
			'Disables check for matching architecture in image and application',
	},
	{
		signature: 'pin-device-to-release',
		boolean: true,
		description:
			'Pin the preloaded device to the preloaded release on provision',
		alias: 'p',
	},
	{
		signature: 'add-certificate',
		parameter: 'certificate.crt',
		description: `\
Add the given certificate (in PEM format) to /etc/ssl/certs in the preloading container.
The file name must end with '.crt' and must not be already contained in the preloader's
/etc/ssl/certs folder.
Can be repeated to add multiple certificates.\
`,
	},
]);
// Remove dockerPort `-p` alias as it conflicts with pin-device-to-release
delete _.find(preloadOptions, { signature: 'dockerPort' }).alias;

export const preload = {
	signature: 'preload <image>',
	description: 'preload an app on a disk image (or Edison zip archive)',
	help: `\
Preload a balena application release (app images/containers), and optionally
a balenaOS splash screen, in a previously downloaded '.img' balenaOS image file
in the local disk (a zip file is only accepted for the Intel Edison device type).
After preloading, the balenaOS image file can be flashed to a device's SD card.
When the device boots, it will not need to download the application, as it was
preloaded.

Warning: "balena preload" requires Docker to be correctly installed in
your shell environment. For more information (including Windows support)
check: https://github.com/balena-io/balena-cli/blob/master/INSTALL.md

Examples:

	$ balena preload balena.img --app 1234 --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0 --splash-image image.png
	$ balena preload balena.img\
`,
	permission: 'user',
	primary: true,
	options: preloadOptions,
	async action(params, options) {
		const balena = getBalenaSdk();
		const balenaPreload = require('balena-preload');
		const visuals = getVisuals();
		const nodeCleanup = require('node-cleanup');
		const { ExpectedError, instanceOf } = require('../errors');

		const progressBars = {};

		const progressHandler = function (event) {
			let progressBar = progressBars[event.name];
			if (!progressBar) {
				progressBar = progressBars[event.name] = new visuals.Progress(
					event.name,
				);
			}
			return progressBar.update({ percentage: event.percentage });
		};

		const spinners = {};

		const spinnerHandler = function (event) {
			let spinner = spinners[event.name];
			if (!spinner) {
				spinner = spinners[event.name] = new visuals.Spinner(event.name);
			}
			if (event.action === 'start') {
				return spinner.start();
			} else {
				console.log();
				return spinner.stop();
			}
		};

		options.commit = isCurrent(options.commit) ? 'latest' : options.commit;
		options.image = params.image;
		options.appId = options.app;
		delete options.app;

		options.splashImage = options['splash-image'];
		delete options['splash-image'];

		options.dontCheckArch = options['dont-check-arch'] || false;
		delete options['dont-check-arch'];
		if (options.dontCheckArch && !options.appId) {
			throw new ExpectedError(
				'You need to specify an app id if you disable the architecture check.',
			);
		}

		options.pinDevice = options['pin-device-to-release'] || false;
		delete options['pin-device-to-release'];

		let certificates;
		if (Array.isArray(options['add-certificate'])) {
			certificates = options['add-certificate'];
		} else if (options['add-certificate'] === undefined) {
			certificates = [];
		} else {
			certificates = [options['add-certificate']];
		}
		for (let certificate of certificates) {
			if (!certificate.endsWith('.crt')) {
				throw new ExpectedError('Certificate file name must end with ".crt"');
			}
		}

		// Get a configured dockerode instance
		const docker = await dockerUtils.getDocker(options);
		const preloader = new balenaPreload.Preloader(
			null,
			docker,
			options.appId,
			options.commit,
			options.image,
			options.splashImage,
			options.proxy,
			options.dontCheckArch,
			options.pinDevice,
			certificates,
		);

		let gotSignal = false;

		nodeCleanup(function (_exitCode, signal) {
			if (signal) {
				gotSignal = true;
				nodeCleanup.uninstall(); // don't call cleanup handler again
				preloader.cleanup().then(() => {
					// calling process.exit() won't inform parent process of signal
					process.kill(process.pid, signal);
				});
				return false;
			}
		});

		if (process.env.DEBUG) {
			preloader.stderr.pipe(process.stderr);
		}

		preloader.on('progress', progressHandler);
		preloader.on('spinner', spinnerHandler);

		try {
			await new Promise(function (resolve, reject) {
				preloader.on('error', reject);
				resolve(prepareAndPreload(preloader, balena, options));
			});
		} catch (err) {
			if (instanceOf(err, balena.errors.BalenaError)) {
				const code = err.code ? `(${err.code})` : '';
				throw new ExpectedError(`${err.message} ${code}`);
			} else {
				throw err;
			}
		} finally {
			if (!gotSignal) {
				await preloader.cleanup();
			}
		}
	},
};
