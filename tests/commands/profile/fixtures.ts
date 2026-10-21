/**
 * @license
 * Copyright 2026 Balena Ltd.
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

import type { MockHttpServer } from '../../mockserver';

type Api = MockHttpServer['api'];

export const FLEET = { id: 100, slug: 'myorg/myfleet' };
export const RPI5 = { id: 1, slug: 'balena_os/raspberrypi5' };
export const RPI4 = { id: 2, slug: 'balena_os/raspberrypi4-64' };

const entry = (
	name: string,
	app: { id: number; slug: string },
	minVersion: string | null,
	description: string | null = null,
) => ({
	catalogs__profile_name: name,
	description,
	application: [app],
	available_since__release:
		minVersion == null ? [] : [{ raw_version: minVersion }],
});

export const CATALOG = {
	bluetooth: entry('bluetooth', RPI5, '6.0.13+rev1', 'Bluetooth support'),
	bluetoothRpi4: entry('bluetooth', RPI4, '6.1.0'),
	metrics: entry('metrics', RPI5, null),
	wifi: entry('wifi', RPI4, '6.1.0-beta.1'),
};

export const pine = (d: object[]) => ({ body: { d } });

/** The fleet lookup done by getApplication(), distinguished from the hostApps one */
export const expectGetFleet = (api: Api) =>
	api.expectPineRequest(
		'GET',
		/\/v7\/application[(?](?!.*is_host)(?!.*balena_os)/,
		pine([FLEET]),
	);

/** The lookup of an OS application by its slug */
export const expectGetHostApp = (
	api: Api,
	hostApp: { id: number; slug: string },
	times = 1,
) =>
	api.expectPineRequest(
		'GET',
		new RegExp(`/v7/application[(?].*${hostApp.slug}`),
		{ ...pine([hostApp]), times },
	);

/** A parent resource of the `/resin/` model, fetched by id expanding `expand` */
const expectGetResinParent = (
	api: Api,
	resource: string,
	id: number,
	expand: string,
	body: object,
) =>
	api.expectPineRequest(
		'GET',
		new RegExp(`/resin/${resource}\\(${id}\\)\\?.*\\$expand=${expand}\\(`),
		pine([{ id, ...body }]),
	);

/** The catalog of an OS application */
export const expectGetCatalogOfApp = (
	api: Api,
	app: { id: number },
	entries: object[],
) =>
	expectGetResinParent(
		api,
		'application',
		app.id,
		'application_profile_catalog',
		{ application_profile_catalog: entries },
	);

/** The profile activations of the fleet */
export const expectGetActivations = (api: Api, rows: object[]) =>
	expectGetResinParent(
		api,
		'application',
		FLEET.id,
		'activates__profile_name__on__application',
		{ activates__profile_name__on__application: rows },
	);

/** The profile overrides of a device */
export const expectGetDeviceOverrides = (
	api: Api,
	device: { id: number },
	rows: object[],
) =>
	expectGetResinParent(api, 'device', device.id, 'device_profile_override', {
		device_profile_override: rows,
	});

/** The image profiles of a release */
export const expectGetImageProfiles = (
	api: Api,
	release: { id: number },
	rows: object[],
) =>
	expectGetResinParent(api, 'release', release.id, 'release_image', {
		release_image: [{ id: 1, image_profile: rows }],
	});

export const expectGetFleetHostApps = (
	api: Api,
	hostApps: Array<{ id: number; slug: string }>,
) =>
	api.expectPineRequest('GET', /\/v7\/application\?.*is_host/, pine(hostApps));

export const operatedBy = (hostApp: { id: number; slug: string }) => [
	{ id: 7, belongs_to__application: [{ id: hostApp.id, slug: hostApp.slug }] },
];

export const DEVICE_A = {
	id: 1001,
	uuid: 'aaaaaaa1111111111111111111111111',
	belongs_to__application: { __id: FLEET.id },
	should_be_operated_by__release: operatedBy(RPI5),
};
export const DEVICE_B = {
	id: 1002,
	uuid: 'bbbbbbb2222222222222222222222222',
	belongs_to__application: { __id: FLEET.id },
	should_be_operated_by__release: operatedBy(RPI5),
};

export const expectGetDevice = (api: Api, device: { uuid: string }) =>
	api.expectPineRequest(
		'GET',
		new RegExp(`/v7/device\\?.*${device.uuid.slice(0, 7)}`),
		pine([device]),
	);

export const bodyOf = async (
	endpoint: Awaited<ReturnType<Api['expectPineRequest']>>,
) =>
	await Promise.all(
		(await endpoint.getSeenRequests()).map(
			async (req) => (await req.body.getJson())!,
		),
	);

export const pathsOf = async (
	endpoint: Awaited<ReturnType<Api['expectPineRequest']>>,
) =>
	(await endpoint.getSeenRequests()).map((req) => decodeURIComponent(req.path));

/** The device lookup done by the profile models, given a full uuid */
export const expectGetDeviceByUuid = (
	api: Api,
	device: { uuid: string },
	times = 1,
) =>
	api.expectPineRequest(
		'GET',
		new RegExp(`/v7/device\\(uuid='${device.uuid}'\\)`),
		{ ...pine([device]), times },
	);

/** The catalog entry lookup of an OS application & profile name, by its natural key */
export const expectGetCatalogEntry = (
	api: Api,
	app: { id: number },
	profileName: string,
	{ found = true, times = 1 } = {},
) =>
	api.expectPineRequest(
		'GET',
		new RegExp(
			`/resin/application_profile_catalog\\(application=${app.id},catalogs__profile_name='${profileName}'\\)`,
		),
		{ ...pine(found ? [{ id: 1 }] : []), times },
	);
