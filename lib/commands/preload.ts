/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
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
import Command from '../command';
import * as cf from '../utils/common-flags';
import {
	getBalenaSdk,
	getCliForm,
	getVisuals,
	stripIndent,
} from '../utils/lazy';
import { applicationIdInfo } from '../utils/messages';
import type { DockerConnectionCliFlags } from '../utils/docker';
import { dockerConnectionCliFlags } from '../utils/docker';
import * as _ from 'lodash';
import type {
	Application,
	BalenaSDK,
	DeviceTypeJson,
	PineExpand,
	Release,
} from 'balena-sdk';
import type { Preloader } from 'balena-preload';
import { parseAsInteger } from '../utils/validation';
import { ExpectedError } from '../errors';

interface FlagsDef extends DockerConnectionCliFlags {
	app?: string;
	commit?: string;
	'splash-image'?: string;
	'dont-check-arch': boolean;
	'pin-device-to-release': boolean;
	'additional-space'?: number;
	'add-certificate'?: string[];
	help: void;
}

interface ArgsDef {
	image: string;
}

export default class PreloadCmd extends Command {
	public static description = stripIndent`
		Preload an app on a disk image (or Edison zip archive).

		Preload a balena application release (app images/containers), and optionally
		a balenaOS splash screen, in a previously downloaded '.img' balenaOS image file
		in the local disk (a zip file is only accepted for the Intel Edison device type).
		After preloading, the balenaOS image file can be flashed to a device's SD card.
		When the device boots, it will not need to download the application, as it was
		preloaded.

		${applicationIdInfo.split('\n').join('\n\t\t')}

		Warning: "balena preload" requires Docker to be correctly installed in
		your shell environment. For more information (including Windows support)
		check: https://github.com/balena-io/balena-cli/blob/master/INSTALL.md
	`;

	public static examples = [
		'$ balena preload balena.img --app MyApp --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0',
		'$ balena preload balena.img --app myorg/myapp --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0 --splash-image image.png',
		'$ balena preload balena.img',
	];

	public static args = [
		{
			name: 'image',
			description: 'the image file path',
			required: true,
		},
	];

	public static usage = 'preload <image>';

	public static flags: flags.Input<FlagsDef> = {
		// TODO: Replace with application/a in #v13?
		app: cf.application,
		commit: flags.string({
			description: `\
The commit hash for a specific application release to preload, use "current" to specify the current
release (ignored if no appId is given). The current release is usually also the latest, but can be
manually pinned using https://github.com/balena-io-projects/staged-releases .\
`,
			char: 'c',
		}),
		'splash-image': flags.string({
			description: 'path to a png image to replace the splash screen',
			char: 's',
		}),
		'dont-check-arch': flags.boolean({
			default: false,
			description:
				'disables check for matching architecture in image and application',
		}),
		'pin-device-to-release': flags.boolean({
			default: false,
			description:
				'pin the preloaded device to the preloaded release on provision',
			char: 'p',
		}),
		'additional-space': flags.integer({
			description:
				'expand the image by this amount of bytes instead of automatically estimating the required amount',
			parse: (x) => parseAsInteger(x, 'additional-space'),
		}),
		'add-certificate': flags.string({
			description: `\
Add the given certificate (in PEM format) to /etc/ssl/certs in the preloading container.
The file name must end with '.crt' and must not be already contained in the preloader's
/etc/ssl/certs folder.
Can be repeated to add multiple certificates.\
`,
			multiple: true,
		}),
		...dockerConnectionCliFlags,
		// Redefining --dockerPort here (defined already in dockerConnectionCliFlags)
		// without -p alias, to avoid clash with -p alias of pin-device-to-release
		dockerPort: flags.integer({
			description:
				'Docker daemon TCP port number (hint: 2375 for balena devices)',
			parse: (p) => parseAsInteger(p, 'dockerPort'),
		}),
		// Not supporting -h for help, because of clash with -h in DockerCliFlags
		// Revisit this in future release.
		help: flags.help({}),
	};

	public static authenticated = true;

	public static primary = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			PreloadCmd,
		);

		const balena = getBalenaSdk();
		const balenaPreload = await import('balena-preload');
		const visuals = getVisuals();
		const nodeCleanup = await import('node-cleanup');
		const { instanceOf } = await import('../errors');

		// Check image file exists
		try {
			const fs = await import('fs');
			await fs.promises.access(params.image);
		} catch (error) {
			throw new ExpectedError(
				`The provided image path does not exist: ${params.image}`,
			);
		}

		// balena-preload currently does not work with numerical app IDs
		// Load app here, and use app slug from hereon
		if (options.app && !options.app.includes('/')) {
			// Disambiguate application (if is a number, it could either be an ID or a numerical name)
			const { getApplication } = await import('../utils/sdk');
			const application = await getApplication(balena, options.app);
			if (!application) {
				throw new ExpectedError(`Application not found: ${options.app}`);
			}
			options.app = application.slug;
		}

		const progressBars: {
			[key: string]: ReturnType<typeof getVisuals>['Progress'];
		} = {};

		const progressHandler = function (event: {
			name: string;
			percentage: number;
		}) {
			const progressBar = (progressBars[event.name] ??= new visuals.Progress(
				event.name,
			));
			return progressBar.update({ percentage: event.percentage });
		};

		const spinners: {
			[key: string]: ReturnType<typeof getVisuals>['Spinner'];
		} = {};

		const spinnerHandler = function (event: { name: string; action: string }) {
			const spinner = (spinners[event.name] ??= new visuals.Spinner(
				event.name,
			));
			if (event.action === 'start') {
				return spinner.start();
			} else {
				console.log();
				return spinner.stop();
			}
		};

		const commit = this.isCurrentCommit(options.commit || '')
			? 'latest'
			: options.commit;
		const image = params.image;
		const appId = options.app;

		const splashImage = options['splash-image'];
		const additionalSpace = options['additional-space'];

		const dontCheckArch = options['dont-check-arch'] || false;
		const pinDevice = options['pin-device-to-release'] || false;

		if (dontCheckArch && !appId) {
			throw new ExpectedError(
				'You need to specify an application if you disable the architecture check.',
			);
		}

		const certificates: string[] = options['add-certificate'] || [];
		for (const certificate of certificates) {
			if (!certificate.endsWith('.crt')) {
				throw new ExpectedError('Certificate file name must end with ".crt"');
			}
		}

		// Get a configured dockerode instance
		const dockerUtils = await import('../utils/docker');
		const docker = await dockerUtils.getDocker(options);
		const preloader = new balenaPreload.Preloader(
			null,
			docker,
			appId,
			commit,
			image,
			splashImage,
			undefined, // TODO: Currently always undefined, investigate approach in ssh command.
			dontCheckArch,
			pinDevice,
			certificates,
			additionalSpace,
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
			await new Promise((resolve, reject) => {
				preloader.on('error', reject);
				resolve(
					this.prepareAndPreload(preloader, balena, {
						appId,
						commit,
						pinDevice,
					}),
				);
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
	}

	readonly applicationExpandOptions: PineExpand<Application> = {
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
		should_be_running__release: {
			$select: 'commit',
		},
	};

	allDeviceTypes: DeviceTypeJson.DeviceType[];
	async getDeviceTypes() {
		if (this.allDeviceTypes === undefined) {
			const balena = getBalenaSdk();
			const deviceTypes = await balena.models.config.getDeviceTypes();
			this.allDeviceTypes = _.sortBy(deviceTypes, 'name');
		}
		return this.allDeviceTypes;
	}

	isCurrentCommit(commit: string) {
		return commit === 'latest' || commit === 'current';
	}

	async getDeviceTypesWithSameArch(deviceTypeSlug: string) {
		const deviceTypes = await this.getDeviceTypes();
		const deviceType = _.find(deviceTypes, { slug: deviceTypeSlug });
		if (!deviceType) {
			throw new Error(`Device type "${deviceTypeSlug}" not found in API query`);
		}
		return _(deviceTypes).filter({ arch: deviceType.arch }).map('slug').value();
	}

	async getApplicationsWithSuccessfulBuilds(deviceTypeSlug: string) {
		const balena = getBalenaSdk();

		const deviceTypes = await this.getDeviceTypesWithSameArch(deviceTypeSlug);
		// TODO: remove the explicit types once https://github.com/balena-io/balena-sdk/pull/889 gets merged
		return balena.pine.get<
			Application,
			Array<
				ApplicationWithDeviceType & {
					should_be_running__release: [Release?];
				}
			>
		>({
			resource: 'my_application',
			options: {
				$filter: {
					is_for__device_type: {
						$any: {
							$alias: 'dt',
							$expr: {
								dt: {
									slug: { $in: deviceTypes },
								},
							},
						},
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
				$expand: this.applicationExpandOptions,
				$select: ['id', 'app_name', 'should_track_latest_release'],
				$orderby: 'app_name asc',
			},
		});
	}

	async selectApplication(deviceTypeSlug: string) {
		const visuals = getVisuals();

		const applicationInfoSpinner = new visuals.Spinner(
			'Downloading list of applications and releases.',
		);
		applicationInfoSpinner.start();

		const applications = await this.getApplicationsWithSuccessfulBuilds(
			deviceTypeSlug,
		);
		applicationInfoSpinner.stop();
		if (applications.length === 0) {
			throw new ExpectedError(
				`You have no apps with successful releases for a '${deviceTypeSlug}' device type.`,
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
	}

	selectApplicationCommit(releases: Release[]) {
		if (releases.length === 0) {
			throw new ExpectedError('This application has no successful releases.');
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
	}

	async offerToDisableAutomaticUpdates(
		application: Application,
		commit: string,
		pinDevice: boolean,
	) {
		const balena = getBalenaSdk();

		if (
			this.isCurrentCommit(commit) ||
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
		const update = await getCliForm().ask({
			message,
			type: 'confirm',
		});
		if (!update) {
			return;
		}
		return await balena.pine.patch({
			resource: 'application',
			id: application.id,
			body: {
				should_track_latest_release: false,
			},
		});
	}

	async getAppWithReleases(balenaSdk: BalenaSDK, appId: string | number) {
		const { getApplication } = await import('../utils/sdk');

		return (await getApplication(balenaSdk, appId, {
			$expand: this.applicationExpandOptions,
		})) as Application & { should_be_running__release: [Release?] };
	}

	async prepareAndPreload(
		preloader: Preloader,
		balenaSdk: BalenaSDK,
		options: {
			appId?: string;
			commit?: string;
			pinDevice: boolean;
		},
	) {
		await preloader.prepare();

		const application = options.appId
			? await this.getAppWithReleases(balenaSdk, options.appId)
			: await this.selectApplication(preloader.config.deviceType);

		let commit: string; // commit hash or the strings 'latest' or 'current'

		const appCommit = application.should_be_running__release[0]?.commit;

		// Use the commit given as --commit or show an interactive commit selection menu
		if (options.commit) {
			if (this.isCurrentCommit(options.commit)) {
				if (!appCommit) {
					throw new Error(
						`Unexpected empty commit hash for app ID "${application.id}"`,
					);
				}
				// handle `--commit current` (and its `--commit latest` synonym)
				commit = 'latest';
			} else {
				const release = _.find(application.owns__release, (r) =>
					r.commit.startsWith(options.commit!),
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
			commit = await this.selectApplicationCommit(
				application.owns__release as Release[],
			);
		}

		await preloader.setAppIdAndCommit(
			application.id,
			this.isCurrentCommit(commit) ? appCommit! : commit,
		);

		// Propose to disable automatic app updates if the commit is not the current release
		await this.offerToDisableAutomaticUpdates(
			application,
			commit,
			options.pinDevice,
		);

		// All options are ready: preload the image.
		await preloader.preload();
	}
}
