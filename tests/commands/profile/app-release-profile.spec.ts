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
	RPI5,
	expectGetCatalogOfApp,
	expectGetImageProfiles,
	pathsOf,
	pine,
} from './fixtures';

const imageProfile = (profile: string, service: string) => ({
	profile_name: profile,
	release_image: [
		{ image: [{ is_a_build_of__service: [{ service_name: service }] }] },
	],
});

describe('balena app/release profile list', function () {
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
		await server.assertAllCalled();
	});

	describe('app profile list', function () {
		it('should list the catalog of an OS application', async () => {
			await api.expectPineRequest(
				'GET',
				/\/v7\/application[(?]/,
				pine([{ id: RPI5.id, slug: RPI5.slug }]),
			);
			const catalog = await expectGetCatalogOfApp(api, RPI5, [
				CATALOG.bluetooth,
				CATALOG.metrics,
			]);

			const { out, err } = await runCommand(
				'app profile list balena_os/raspberrypi5',
			);
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out, true)).to.deep.equal([
				'PROFILE MIN VERSION DESCRIPTION',
				'bluetooth 6.0.13+rev1 Bluetooth support',
				'metrics N/A',
			]);
			expect((await pathsOf(catalog))[0]).to.contain(
				`/resin/application(${RPI5.id})`,
			);
		});

		it('should output JSON with --json', async () => {
			// No application lookup is needed given its numeric ID
			await expectGetCatalogOfApp(api, RPI5, [CATALOG.wifi]);

			const { out, err } = await runCommand(
				`app profile list ${RPI5.id} --json`,
			);
			expect(err).to.deep.equal([]);
			expect(JSON.parse(out.join(''))).to.deep.equal([
				{
					profile: 'wifi',
					description: null,
					min_version: '6.1.0-beta.1',
				},
			]);
		});

		it('should report apps without profiles', async () => {
			await api.expectPineRequest(
				'GET',
				/\/v7\/application[(?]/,
				pine([{ id: RPI5.id, slug: RPI5.slug }]),
			);
			await expectGetCatalogOfApp(api, RPI5, []);

			const { out } = await runCommand(
				'app profile list balena_os/raspberrypi5',
			);
			expect(cleanOutput(out)).to.deep.equal([
				'No profiles available for balena_os/raspberrypi5',
			]);
		});
	});

	describe('release profile list', function () {
		it('should list the profiles of a release with their services', async () => {
			await api.expectPineRequest('GET', /\/v7\/release\?/, pine([{ id: 7 }]));
			const imageProfiles = await expectGetImageProfiles(api, { id: 7 }, [
				imageProfile('metrics', 'node-exporter'),
				imageProfile('bluetooth', 'bluez'),
				imageProfile('bluetooth', 'bt-agent'),
			]);

			const { out, err } = await runCommand('release profile list 27fda508c');
			expect(err).to.deep.equal([]);
			expect(cleanOutput(out, true)).to.deep.equal([
				'PROFILE SERVICES',
				'bluetooth bluez, bt-agent',
				'metrics node-exporter',
			]);
			expect((await pathsOf(imageProfiles))[0]).to.contain('/resin/release(7)');
		});

		it('should output JSON with --json', async () => {
			// No release lookup is needed given its numeric ID
			await expectGetImageProfiles(api, { id: 7 }, [
				imageProfile('bluetooth', 'bluez'),
			]);

			const { out, err } = await runCommand('release profile list 7 --json');
			expect(err).to.deep.equal([]);
			expect(JSON.parse(out.join(''))).to.deep.equal([
				{ profile: 'bluetooth', services: ['bluez'] },
			]);
		});

		it('should report releases without profiles', async () => {
			await api.expectPineRequest('GET', /\/v7\/release\?/, pine([{ id: 7 }]));
			await expectGetImageProfiles(api, { id: 7 }, []);

			const { out } = await runCommand('release profile list 27fda508c');
			expect(cleanOutput(out)).to.deep.equal([
				'No profiles found for this release',
			]);
		});
	});
});
