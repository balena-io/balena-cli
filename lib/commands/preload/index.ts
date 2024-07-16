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

import Command from '../../command.js';
import { ExpectedError } from '../../errors.js';
import * as cf from '../../utils/common-flags.js';
import {
	getBalenaSdk,
	getCliForm,
	getVisuals,
	stripIndent,
} from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';
import { dockerConnectionCliFlags } from '../../utils/docker.js';
import { parseAsInteger } from '../../utils/validation.js';

import { Flags, Args } from '@oclif/core';
import _ from 'lodash';
import type {
	Application,
	BalenaSDK,
	PineExpand,
	PineOptions,
	PineTypedResult,
	Release,
} from 'balena-sdk';
import type { Preloader } from 'balena-preload';
import type { EventEmitter } from 'events';

export default class PreloadCmd extends Command {
	public static description = stripIndent`
		Preload a release on a disk image (or Edison zip archive).

		Preload a release (service images/containers) from a balena fleet, and optionally
		a balenaOS splash screen, in a previously downloaded '.img' balenaOS image file
		in the local disk (a zip file is only accepted for the Intel Edison device type).
		After preloading, the balenaOS image file can be flashed to a device's SD card.
		When the device boots, it will not need to download the release, as it was
		preloaded. This is usually combined with release pinning
		(https://www.balena.io/docs/learn/deploy/release-strategy/release-policy/)
		to avoid the device downloading a newer release straight away, if available.
		Check also the Preloading and Preregistering section of the balena CLI's advanced
		masterclass document:
		https://www.balena.io/docs/learn/more/masterclasses/advanced-cli/#5-preloading-and-preregistering

		${applicationIdInfo.split('\n').join('\n\t\t')}

		Note that the this command requires Docker to be installed, as further detailed
		in the balena CLI's installation instructions:
		https://github.com/balena-io/balena-cli/blob/master/INSTALL.md
		The \`--dockerHost\` and \`--dockerPort\` flags allow a remote Docker engine to
		be used, however the image file must be accessible to the remote Docker engine
		on the same path given on the command line. This is because Docker's bind mount
		feature is used to "share" the image with a container that performs the preload.
	`;

	public static examples = [
		'$ balena preload balena.img --fleet MyFleet --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0',
		'$ balena preload balena.img --fleet myorg/myfleet --splash-image image.png',
		'$ balena preload balena.img',
	];

	public static args = {
		image: Args.string({
			description: 'the image file path',
			required: true,
		}),
	};

	public static usage = 'preload <image>';

	public static flags = {
		fleet: cf.fleet,
		commit: Flags.string({
			description: `\
The commit hash of the release to preload. Use "current" to specify the current
release (ignored if no appId is given). The current release is usually also the
latest, but can be pinned to a specific release. See:  
https://www.balena.io/docs/learn/deploy/release-strategy/release-policy/  
https://www.balena.io/docs/learn/more/masterclasses/fleet-management/#63-pin-using-the-api  
https://github.com/balena-io-examples/staged-releases\
`,
			char: 'c',
		}),
		'splash-image': Flags.string({
			description: 'path to a png image to replace the splash screen',
			char: 's',
		}),
		'dont-check-arch': Flags.boolean({
			default: false,
			description:
				'disable architecture compatibility check between image and fleet',
		}),
		'pin-device-to-release': Flags.boolean({
			allowNo: true,
			description:
				'pin the preloaded device to the preloaded release on provision',
			char: 'p',
		}),
		'additional-space': Flags.integer({
			description:
				'expand the image by this amount of bytes instead of automatically estimating the required amount',
			parse: async (x) => parseAsInteger(x, 'additional-space'),
		}),
		'add-certificate': Flags.string({
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
		dockerPort: Flags.integer({
			description:
				'Docker daemon TCP port number (hint: 2375 for balena devices)',
			parse: async (p) => parseAsInteger(p, 'dockerPort'),
		}),
		// Not supporting -h for help, because of clash with -h in DockerCliFlags
		// Revisit this in future release.
		help: Flags.help({}),
	};

	public static authenticated = true;

	public static primary = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(PreloadCmd);

		const balena = getBalenaSdk();
		const { default: balenaPreload } = await import('balena-preload');
		const visuals = getVisuals();
		const { default: nodeCleanup } = await import('node-cleanup');
		const { instanceOf } = await import('../../errors.js');

		// Check image file exists
		try {
			const fs = await import('fs');
			await fs.promises.access(params.image);
			const path = await import('path');
			if (path.extname(params.image) === '.zip') {
				console.warn(stripIndent`
					------------------------------------------------------------------------------
					Warning: A zip file is only accepted for the Intel Edison device type.
					------------------------------------------------------------------------------
					`);
			}
		} catch (error) {
			throw new ExpectedError(
				`The provided image path does not exist: ${params.image}`,
			);
		}

		// balena-preload currently does not work with numerical app IDs
		// Load app here, and use app slug from hereon
		const fleetSlug: string | undefined = options.fleet
			? await (
					await import('../../utils/sdk.js')
				).getFleetSlug(balena, options.fleet)
			: undefined;

		const progressBars: {
			[key: string]: InstanceType<ReturnType<typeof getVisuals>['Progress']>;
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
			[key: string]: InstanceType<ReturnType<typeof getVisuals>['Spinner']>;
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
		const splashImage = options['splash-image'];
		const additionalSpace = options['additional-space'];
		const dontCheckArch = options['dont-check-arch'] || false;
		const pinDevice = options['pin-device-to-release'];

		if (dontCheckArch && !fleetSlug) {
			throw new ExpectedError(
				'You need to specify a fleet if you disable the architecture check.',
			);
		}

		const certificates: string[] = options['add-certificate'] || [];
		for (const certificate of certificates) {
			if (!certificate.endsWith('.crt')) {
				throw new ExpectedError('Certificate file name must end with ".crt"');
			}
		}

		// Get a configured dockerode instance
		const dockerUtils = await import('../../utils/docker.js');
		const docker = await dockerUtils.getDocker(options);
		const preloader = new balenaPreload.Preloader(
			undefined,
			docker,
			fleetSlug,
			commit,
			image,
			splashImage,
			undefined, // TODO: Currently always undefined, investigate approach in ssh command.
			dontCheckArch,
			pinDevice ?? false,
			certificates,
			additionalSpace,
		) as Preloader & EventEmitter;

		let gotSignal = false;

		nodeCleanup(function (_exitCode, signal) {
			if (signal) {
				gotSignal = true;
				nodeCleanup.uninstall(); // don't call cleanup handler again
				preloader
					.cleanup()
					.then(() => {
						// calling process.exit() won't inform parent process of signal
						process.kill(process.pid, signal);
					})
					.catch((e) => {
						if (process.env.DEBUG) {
							console.error(e);
						}
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
						slug: fleetSlug,
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

	readonly applicationExpandOptions = {
		owns__release: {
			$select: ['id', 'commit', 'end_timestamp', 'composition'],
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
			$orderby: [{ end_timestamp: 'desc' }, { id: 'desc' }],
		},
		should_be_running__release: {
			$select: 'commit',
		},
	} satisfies PineExpand<Application>;

	isCurrentCommit(commit: string) {
		return commit === 'latest' || commit === 'current';
	}

	async getApplicationsWithSuccessfulBuilds(deviceTypeSlug: string) {
		const balena = getBalenaSdk();

		try {
			await balena.models.deviceType.get(deviceTypeSlug);
		} catch {
			throw new Error(`Device type "${deviceTypeSlug}" not found in API query`);
		}
		const options = {
			$select: ['id', 'slug', 'should_track_latest_release'],
			$expand: this.applicationExpandOptions,
			$filter: {
				// get the apps that are of the same arch as the device type of the image
				is_for__device_type: {
					$any: {
						$alias: 'dt',
						$expr: {
							dt: {
								is_of__cpu_architecture: {
									$any: {
										$alias: 'ioca',
										$expr: {
											ioca: {
												is_supported_by__device_type: {
													$any: {
														$alias: 'isbdt',
														$expr: {
															isbdt: {
																slug: deviceTypeSlug,
															},
														},
													},
												},
											},
										},
									},
								},
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
			$orderby: 'slug asc',
		} satisfies PineOptions<Application>;
		return (await balena.models.application.getAllDirectlyAccessible(
			options,
		)) as Array<PineTypedResult<Application, typeof options>>;
	}

	async selectApplication(deviceTypeSlug: string) {
		const visuals = getVisuals();

		const applicationInfoSpinner = new visuals.Spinner(
			'Downloading list of applications and releases.',
		);
		applicationInfoSpinner.start();

		const applications =
			await this.getApplicationsWithSuccessfulBuilds(deviceTypeSlug);
		applicationInfoSpinner.stop();
		if (applications.length === 0) {
			throw new ExpectedError(
				`No fleets found with successful releases for device type '${deviceTypeSlug}'`,
			);
		}
		return getCliForm().ask({
			message: 'Select a fleet',
			type: 'list',
			choices: applications.map((app) => ({
				name: app.slug,
				value: app,
			})),
		});
	}

	selectApplicationCommit(releases: Release[]) {
		if (releases.length === 0) {
			throw new ExpectedError('This fleet has no successful releases.');
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
		application: Pick<Application, 'id' | 'should_track_latest_release'>,
		commit: string,
		pinDevice: boolean | undefined,
	) {
		const balena = getBalenaSdk();

		if (
			this.isCurrentCommit(commit) ||
			!application.should_track_latest_release ||
			pinDevice != null
		) {
			return;
		}
		const message = `\

This fleet is set to track the latest release, and non-pinned devices
are automatically updated when a new release is available. This may lead to
unexpected behavior: The preloaded device will download and install the latest
release once it is online.

This prompt gives you the opportunity to disable automatic updates for
this fleet now. Note that this would result in the fleet being pinned to
the current latest release, rather than some other release that may have
been selected for preloading. The pinned released may be further managed
through the web dashboard or programatically through the balena API / SDK.
Documentation about release policies and pinning can be found at:
https://www.balena.io/docs/learn/deploy/release-strategy/release-policy/

Alternatively, the --pin-device-to-release or --no-pin-device-to-release flags may be used
to avoid this interactive confirmation and pin only the preloaded device to the selected release
or keep it unpinned respectively.

Would you like to disable automatic updates for this fleet now?\
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

	async getAppWithReleases(balenaSdk: BalenaSDK, slug: string) {
		const { getApplication } = await import('../../utils/sdk.js');

		return await getApplication(balenaSdk, slug, {
			$expand: this.applicationExpandOptions,
		});
	}

	async prepareAndPreload(
		preloader: Preloader,
		balenaSdk: BalenaSDK,
		options: {
			slug?: string;
			commit?: string;
			pinDevice?: boolean;
		},
	) {
		await preloader.prepare();

		const application = options.slug
			? await this.getAppWithReleases(balenaSdk, options.slug)
			: await this.selectApplication(preloader.config!.deviceType);

		let commit: string; // commit hash or the strings 'latest' or 'current'

		const appCommit = application.should_be_running__release[0]?.commit;

		// Use the commit given as --commit or show an interactive commit selection menu
		if (options.commit) {
			if (this.isCurrentCommit(options.commit)) {
				if (!appCommit) {
					throw new Error(
						`Unexpected empty commit hash for fleet slug "${application.slug}"`,
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
