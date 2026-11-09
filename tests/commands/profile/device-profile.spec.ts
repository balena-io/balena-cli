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

import { expect } from 'chai';
import { cleanOutput, runCommand } from '../../helpers';
import { MockHttpServer } from '../../mockserver';
import {
	CATALOG,
	DEVICE_A,
	DEVICE_B,
	RPI5,
	bodyOf,
	expectGetActivations,
	expectGetCatalogOfApp,
	expectGetCatalogEntry,
	expectGetDevice,
	expectGetDeviceByUuid,
	expectGetDeviceOverrides,
	expectGetImageProfiles,
	pathsOf,
	pine,
} from './fixtures';

const A = DEVICE_A.uuid.slice(0, 7);
const B = DEVICE_B.uuid.slice(0, 7);

const OVERRIDES = /\/resin\/device_profile_override$/;
const OVERRIDES_BY_FILTER = /\/resin\/device_profile_override\?\$filter=/;
const overrideOf = (device: { id: number }, profileName: string) =>
	new RegExp(
		`/resin/device_profile_override\\(device=${device.id},overrides__profile_name='${profileName}',on__application=${RPI5.id}\\)$`,
	);

describe('balena device profile', function () {
	let api: MockHttpServer['api'];
	let server: MockHttpServer;

	before(async () => {
		server = new MockHttpServer();
		api = server.api;
		await server.start();
		await api.expectGetWhoAmI({ optional: true, persist: true });
	});

	after(async () => {
		await server.stop();
	});

	afterEach(async () => {
		process.exitCode = undefined;
		await server.assertAllCalled();
	});

	describe('list', function () {
		const expectListRequests = async () => {
			await expectGetDevice(api, DEVICE_A);
			const catalog = await expectGetCatalogOfApp(api, RPI5, [
				CATALOG.bluetooth,
				CATALOG.metrics,
			]);
			const imageProfiles = await expectGetImageProfiles(api, { id: 7 }, [
				{ profile_name: 'bluetooth' },
			]);
			const activations = await expectGetActivations(api, [
				{ activates__profile_name: 'metrics' },
			]);
			const overrides = await expectGetDeviceOverrides(api, DEVICE_A, [
				{ overrides__profile_name: 'bluetooth', is_active: false },
			]);
			return { catalog, imageProfiles, activations, overrides };
		};

		it('should list the profiles and their effective state', async () => {
			const { catalog, imageProfiles, activations, overrides } =
				await expectListRequests();

			const { out, err } = await runCommand(`device profile list ${A}`);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out, true)).to.deep.equal([
				'== balena_os/raspberrypi5',
				'PROFILE MIN VERSION IN CURRENT OS FLEET OVERRIDE EFFECTIVE',
				'bluetooth 6.0.13+rev1 yes off off off',
				'metrics N/A no on - on',
			]);

			// Everything is scoped to the hostApp of the device's OS release
			expect((await pathsOf(catalog))[0]).to.contain(
				`/resin/application(${RPI5.id})`,
			);
			expect((await pathsOf(imageProfiles))[0]).to.contain('/resin/release(7)');
			const [activationsPath] = await pathsOf(activations);
			expect(activationsPath).to.contain(
				`/resin/application(${DEVICE_A.belongs_to__application.__id})`,
			);
			expect(activationsPath).to.contain(`on__application eq ${RPI5.id}`);
			const [overridesPath] = await pathsOf(overrides);
			expect(overridesPath).to.contain(`/resin/device(${DEVICE_A.id})`);
			expect(overridesPath).to.contain(`on__application eq ${RPI5.id}`);
		});

		it('should output JSON with --json', async () => {
			await expectListRequests();

			const { out, err } = await runCommand(`device profile list ${A} --json`);
			expect(err).to.deep.equal([]);
			expect(JSON.parse(out.join(''))).to.deep.equal({
				os_application: { id: 1, slug: 'balena_os/raspberrypi5' },
				profiles: [
					{
						profile: 'bluetooth',
						description: 'Bluetooth support',
						min_version: '6.0.13+rev1',
						in_current_os: true,
						fleet: false,
						override: false,
						effective: false,
					},
					{
						profile: 'metrics',
						description: null,
						min_version: null,
						in_current_os: false,
						fleet: true,
						override: null,
						effective: true,
					},
				],
			});
		});

		it('should error for devices without an OS release', async () => {
			const device = { ...DEVICE_A, should_be_operated_by__release: [] };
			await expectGetDevice(api, device);

			const { err } = await runCommand(`device profile list ${A}`);
			expect(cleanOutput(err, true).join(' ')).to.contain(
				`Device ${DEVICE_A.uuid} is not operated by any OS release`,
			);
		});
	});

	describe('activate', function () {
		it('should upsert an active override per device and profile', async () => {
			await expectGetDevice(api, DEVICE_A);
			await expectGetDevice(api, DEVICE_B);
			await expectGetDeviceByUuid(api, DEVICE_A, 2);
			await expectGetDeviceByUuid(api, DEVICE_B, 2);
			await expectGetCatalogEntry(api, RPI5, 'bluetooth', { times: 2 });
			await expectGetCatalogEntry(api, RPI5, 'metrics', { times: 2 });
			const post = await api.expectPineRequest('POST', OVERRIDES, {
				status: 201,
				body: {},
				times: 4,
			});

			const { out, err } = await runCommand(
				`device profile activate ${A},${B} bluetooth,metrics`,
			);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'bluetooth' activated on device ${DEVICE_A.uuid}`,
				`Profile 'metrics' activated on device ${DEVICE_A.uuid}`,
				`Profile 'bluetooth' activated on device ${DEVICE_B.uuid}`,
				`Profile 'metrics' activated on device ${DEVICE_B.uuid}`,
			]);
			// The POSTs run concurrently, so their order is not deterministic
			const key = (b: any) => `${b.device}:${b.overrides__profile_name}`;
			expect(
				(await bodyOf(post)).sort((a, b) => key(a).localeCompare(key(b))),
			).to.deep.equal(
				[DEVICE_A, DEVICE_B].flatMap((d) =>
					['bluetooth', 'metrics'].map((name) => ({
						device: d.id,
						overrides__profile_name: name,
						on__application: RPI5.id,
						is_active: true,
					})),
				),
			);
		});

		it('should report profiles not provided by the device OS application and continue', async () => {
			await expectGetDevice(api, DEVICE_A);
			await expectGetDeviceByUuid(api, DEVICE_A, 2);
			await expectGetCatalogEntry(api, RPI5, 'wifi', { found: false });
			await expectGetCatalogEntry(api, RPI5, 'metrics');
			await api.expectPineRequest('POST', OVERRIDES, {
				status: 201,
				body: {},
			});

			const { out, err, exitCode } = await runCommand(
				`device profile activate ${A} wifi,metrics`,
			);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'metrics' activated on device ${DEVICE_A.uuid}`,
			]);
			expect(cleanOutput(err)).to.deep.equal([
				`Profile 'wifi' is not provided by balena_os/raspberrypi5, uuid: ${A}, profile: wifi`,
			]);
			expect(exitCode).to.equal(1);
		});
	});

	describe('deactivate', function () {
		it('should update an existing override to inactive', async () => {
			await expectGetDevice(api, DEVICE_A);
			await expectGetDeviceByUuid(api, DEVICE_A);
			await expectGetCatalogEntry(api, RPI5, 'bluetooth');
			// upsert: the POST conflicts with the existing override, so it PATCHes it
			await api.expectPineRequest('POST', OVERRIDES, {
				status: 409,
				body: '"Unique key constraint violated"',
			});
			const patch = await api.expectPineRequest('PATCH', OVERRIDES_BY_FILTER);

			const { out, err } = await runCommand(
				`device profile deactivate ${A} bluetooth`,
			);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'bluetooth' deactivated on device ${DEVICE_A.uuid}`,
			]);
			expect(await bodyOf(patch)).to.deep.equal([{ is_active: false }]);
			const [patchPath] = await pathsOf(patch);
			expect(patchPath).to.contain(`device eq ${DEVICE_A.id}`);
			expect(patchPath).to.contain(`overrides__profile_name eq 'bluetooth'`);
			expect(patchPath).to.contain(`on__application eq ${RPI5.id}`);
		});
	});

	describe('remove-override', function () {
		it('should delete the overrides of the given profiles by their natural key', async () => {
			await expectGetDevice(api, DEVICE_A);
			await expectGetDeviceByUuid(api, DEVICE_A, 2);
			await api.expectPineRequest('DELETE', overrideOf(DEVICE_A, 'bluetooth'));
			await api.expectPineRequest('DELETE', overrideOf(DEVICE_A, 'metrics'));

			const { out, err } = await runCommand(
				`device profile remove-override ${A} bluetooth,metrics`,
			);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'bluetooth' override removed from device ${DEVICE_A.uuid}`,
				`Profile 'metrics' override removed from device ${DEVICE_A.uuid}`,
			]);
		});

		it('should report unknown devices and continue with the rest', async () => {
			await api.expectPineRequest('GET', /\/v7\/device\?.*fffffff/, pine([]));
			await expectGetDevice(api, DEVICE_A);
			await expectGetDeviceByUuid(api, DEVICE_A);
			await api.expectPineRequest('DELETE', overrideOf(DEVICE_A, 'metrics'));

			const { out, err, exitCode } = await runCommand(
				`device profile remove-override fffffff,${A} metrics`,
			);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'metrics' override removed from device ${DEVICE_A.uuid}`,
			]);
			expect(cleanOutput(err, true).join(' ')).to.contain(
				'Device not found: fffffff, uuid: fffffff, profile: metrics',
			);
			expect(exitCode).to.equal(1);
		});
	});
});
