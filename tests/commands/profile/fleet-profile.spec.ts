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
	FLEET,
	RPI4,
	RPI5,
	bodyOf,
	expectGetActivations,
	expectGetCatalogEntry,
	expectGetCatalogOfApp,
	expectGetFleet,
	expectGetFleetHostApps,
	expectGetHostApp,
	pathsOf,
} from './fixtures';

const ACTIVATIONS = /\/resin\/application_profile$/;

describe('balena fleet profile', function () {
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
		it('should list profiles grouped by OS application', async () => {
			await expectGetFleet(api);
			const hostApps = await expectGetFleetHostApps(api, [RPI4, RPI5]);
			await expectGetCatalogOfApp(api, RPI4, []);
			const catalog = await expectGetCatalogOfApp(api, RPI5, [
				CATALOG.bluetooth,
				CATALOG.metrics,
			]);
			const activations = await expectGetActivations(api, [
				{ activates__profile_name: 'bluetooth', on__application: { __id: 1 } },
			]);

			const { out, err } = await runCommand('fleet profile list myorg/myfleet');
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out, true)).to.deep.equal([
				'== balena_os/raspberrypi4-64',
				'No profiles available',
				'== balena_os/raspberrypi5',
				'PROFILE ACTIVE DESCRIPTION',
				'bluetooth yes Bluetooth support',
				'metrics no',
			]);

			// The hostApps the fleet's devices are operated by
			const [hostAppsPath] = await pathsOf(hostApps);
			expect(hostAppsPath).to.contain('is_host eq true');
			expect(hostAppsPath).to.contain(
				`should_operate__device/any(d:d/belongs_to__application eq ${FLEET.id})`,
			);
			// Uses the /resin/ model
			expect((await pathsOf(catalog))[0]).to.match(/\/resin\//);
			expect((await pathsOf(activations))[0]).to.contain(
				`/resin/application(${FLEET.id})`,
			);
		});

		it('should output JSON with --json', async () => {
			await expectGetFleet(api);
			await expectGetFleetHostApps(api, [RPI5]);
			await expectGetCatalogOfApp(api, RPI5, [CATALOG.bluetooth]);
			await expectGetActivations(api, []);

			const { out, err } = await runCommand(
				`fleet profile list ${FLEET.id} --json`,
			);
			expect(err).to.deep.equal([]);
			expect(JSON.parse(out.join(''))).to.deep.equal([
				{
					os_application: { id: 1, slug: 'balena_os/raspberrypi5' },
					profiles: [
						{
							profile: 'bluetooth',
							is_active: false,
							description: 'Bluetooth support',
						},
					],
				},
			]);
		});

		it('should report fleets without devices operated by an OS application', async () => {
			await expectGetFleet(api);
			await expectGetFleetHostApps(api, []);
			await expectGetActivations(api, []);

			const { out } = await runCommand('fleet profile list myorg/myfleet');
			expect(cleanOutput(out)).to.deep.equal([
				'No devices of fleet myorg/myfleet are operated by an OS application',
			]);
		});
	});

	describe('activate', function () {
		it('should activate profiles by their natural key', async () => {
			await expectGetFleet(api);
			await expectGetHostApp(api, RPI5, 2);
			await expectGetCatalogEntry(api, RPI5, 'bluetooth');
			await expectGetCatalogEntry(api, RPI5, 'metrics');
			const post = await api.expectPineRequest('POST', ACTIVATIONS, {
				status: 201,
				body: {},
				times: 2,
			});

			const { out, err } = await runCommand(
				`fleet profile activate myorg/myfleet ${RPI5.slug} bluetooth,metrics`,
			);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'bluetooth' activated for fleet myorg/myfleet`,
				`Profile 'metrics' activated for fleet myorg/myfleet`,
			]);
			// The POSTs run concurrently, so their order is not deterministic
			const bodies = (await bodyOf(post)) as Array<{
				activates__profile_name: string;
			}>;
			expect(
				bodies.sort((a, b) =>
					a.activates__profile_name.localeCompare(b.activates__profile_name),
				),
			).to.deep.equal(
				['bluetooth', 'metrics'].map((name) => ({
					application: FLEET.id,
					activates__profile_name: name,
					on__application: RPI5.id,
				})),
			);
		});

		it('should treat a conflict as already active', async () => {
			await expectGetFleet(api);
			await expectGetHostApp(api, RPI5);
			await expectGetCatalogEntry(api, RPI5, 'metrics');
			await api.expectPineRequest('POST', ACTIVATIONS, {
				status: 409,
				body: '"Unique key constraint violated"',
			});

			const { out, err } = await runCommand(
				`fleet profile activate myorg/myfleet ${RPI5.slug} metrics`,
			);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'metrics' activated for fleet myorg/myfleet`,
			]);
		});

		it('should report profiles not provided by the OS application and continue', async () => {
			await expectGetFleet(api);
			await expectGetHostApp(api, RPI5, 2);
			await expectGetCatalogEntry(api, RPI5, 'ebpf', { found: false });
			await expectGetCatalogEntry(api, RPI5, 'metrics');
			await api.expectPineRequest('POST', ACTIVATIONS, {
				status: 201,
				body: {},
			});

			const { out, err, exitCode } = await runCommand(
				`fleet profile activate myorg/myfleet ${RPI5.slug} ebpf,metrics`,
			);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'metrics' activated for fleet myorg/myfleet`,
			]);
			expect(cleanOutput(err)).to.deep.equal([
				`Profile 'ebpf' is not provided by ${RPI5.slug}, profile: ebpf`,
			]);
			expect(exitCode).to.equal(1);
		});

		it('should default to the only OS application of the fleet', async () => {
			await expectGetFleet(api);
			const hostApps = await expectGetFleetHostApps(api, [RPI5]);
			await expectGetCatalogEntry(api, RPI5, 'metrics');
			const post = await api.expectPineRequest('POST', ACTIVATIONS, {
				status: 201,
				body: {},
			});

			const { out, err } = await runCommand(
				'fleet profile activate myorg/myfleet metrics',
			);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'metrics' activated for fleet myorg/myfleet`,
			]);
			expect(await bodyOf(post)).to.deep.equal([
				{
					application: FLEET.id,
					activates__profile_name: 'metrics',
					on__application: RPI5.id,
				},
			]);
			expect((await pathsOf(hostApps))[0]).to.contain(
				`should_operate__device/any(d:d/belongs_to__application eq ${FLEET.id})`,
			);
		});

		it('should require the OS application for fleets running more than one', async () => {
			await expectGetFleet(api);
			await expectGetFleetHostApps(api, [RPI4, RPI5]);

			const { err, exitCode } = await runCommand(
				'fleet profile activate myorg/myfleet metrics',
			);
			expect(cleanOutput(err)).to.deep.equal([
				`Fleets that run more than one OS application (${RPI4.slug}, ${RPI5.slug}) need the OS application to be specified, profile: metrics`,
			]);
			expect(exitCode).to.equal(1);
		});

		it('should require the profile names', async () => {
			const { err } = await runCommand('fleet profile activate myorg/myfleet');
			expect(cleanOutput(err, true).join(' ')).to.contain(
				'At least one profile name must be provided',
			);
		});

		it('should reject invalid profile names', async () => {
			const { err } = await runCommand(
				`fleet profile activate myorg/myfleet ${RPI5.slug} b@d`,
			);
			expect(cleanOutput(err, true).join(' ')).to.contain(
				'Invalid profile name "b@d"',
			);
		});
	});

	describe('deactivate', function () {
		it('should delete activations by their natural key', async () => {
			await expectGetFleet(api);
			await expectGetHostApp(api, RPI4, 2);
			const activationOf = (name: string) =>
				new RegExp(
					`/resin/application_profile\\(application=${FLEET.id},activates__profile_name='${name}',on__application=${RPI4.id}\\)$`,
				);
			await api.expectPineRequest('DELETE', activationOf('bluetooth'));
			await api.expectPineRequest('DELETE', activationOf('metrics'));

			const { out, err } = await runCommand(
				`fleet profile deactivate myorg/myfleet ${RPI4.slug} bluetooth,metrics`,
			);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'bluetooth' deactivated for fleet myorg/myfleet`,
				`Profile 'metrics' deactivated for fleet myorg/myfleet`,
			]);
		});

		it('should default to the only OS application of the fleet', async () => {
			await expectGetFleet(api);
			await expectGetFleetHostApps(api, [RPI4]);
			await api.expectPineRequest(
				'DELETE',
				new RegExp(
					`/resin/application_profile\\(application=${FLEET.id},activates__profile_name='metrics',on__application=${RPI4.id}\\)$`,
				),
			);

			const { out, err } = await runCommand(
				'fleet profile deactivate myorg/myfleet metrics',
			);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out)).to.deep.equal([
				`Profile 'metrics' deactivated for fleet myorg/myfleet`,
			]);
		});
	});

	describe('--help', function () {
		it('should show the help of the nested command', async () => {
			const { out, err } = await runCommand('fleet profile activate --help');
			expect(err).to.deep.equal([]);
			const lines = cleanOutput(out, true);
			expect(lines[0]).to.equal('Activate OS profiles for a fleet.');
			expect(lines).to.include(
				'$ balena fleet profile activate FLEET [HOSTAPP] [PROFILES]',
			);
		});
	});
});
