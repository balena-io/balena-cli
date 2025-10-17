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

import { expect } from 'chai';
import * as path from 'path';

import { apiResponsePath } from '../../nock/balena-api-mock';
import { cleanOutput, runCommand } from '../../helpers';
import { MockHttpServer } from '../../mockserver';

describe('balena device', function () {
	let api: MockHttpServer['api'];
	let server: MockHttpServer;

	this.beforeAll(async () => {
		server = new MockHttpServer();
		api = server.api;
		await server.start();
		await api.expectGetWhoAmI({ optional: true, persist: true });
	});

	this.afterAll(async () => {
		await server.stop();
	});

	this.afterEach(async () => {
		await server.assertAllCalled();
	});

	it('should error if uuid not provided', async () => {
		const { out, err } = await runCommand('device');
		const errLines = cleanOutput(err);

		expect(errLines[0]).to.equal('Missing 1 required argument:');
		expect(errLines[1]).to.equal('uuid : the device uuid');
		expect(out).to.eql([]);
	});

	it('should list device details for provided uuid', async () => {
		await server.mockttp
			.forGet('/v7/device')
			.withExactQuery(
				'?$filter=startswith(uuid,%2727fda508c%27)&$select=device_name,id,overall_status,is_online,ip_address,mac_address,last_connectivity_event,uuid,supervisor_version,is_web_accessible,note,os_version,memory_usage,memory_total,public_address,storage_block_device,storage_usage,storage_total,cpu_usage,cpu_temp,cpu_id,is_undervolted&$expand=belongs_to__application($select=app_name,slug),is_of__device_type($select=slug),is_running__release($select=commit)',
			)
			.thenReply(
				200,
				await import('fs').then((fs) =>
					fs.readFileSync(path.join(apiResponsePath, 'device.json'), 'utf8'),
				),
				{
					'Content-Type': 'application/json',
				},
			);

		const { out } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		expect(lines).to.have.lengthOf(25);
		expect(lines[0]).to.equal('== SPARKLING WOOD');
		expect(lines[6].split(':')[1].trim()).to.equal('org/test app');
	});

	it('correctly handles devices with missing fields', async () => {
		await server.mockttp
			.forGet('/v7/device')
			.withExactQuery(
				'?$filter=startswith(uuid,%2727fda508c%27)&$select=device_name,id,overall_status,is_online,ip_address,mac_address,last_connectivity_event,uuid,supervisor_version,is_web_accessible,note,os_version,memory_usage,memory_total,public_address,storage_block_device,storage_usage,storage_total,cpu_usage,cpu_temp,cpu_id,is_undervolted&$expand=belongs_to__application($select=app_name,slug),is_of__device_type($select=slug),is_running__release($select=commit)',
			)
			.thenReply(
				200,
				await import('fs').then((fs) =>
					fs.readFileSync(
						path.join(apiResponsePath, 'device-missing-fields.json'),
						'utf8',
					),
				),
				{
					'Content-Type': 'application/json',
				},
			);

		const { out } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		expect(lines).to.have.lengthOf(14);
		expect(lines[0]).to.equal('== SPARKLING WOOD');
		expect(lines[6].split(':')[1].trim()).to.equal('org/test app');
	});

	it('correctly handles devices with missing application', async () => {
		// Devices with missing applications will have application name set to `N/a`.
		// e.g. When user has a device associated with app that user is no longer a collaborator of.
		await server.mockttp
			.forGet('/v7/device')
			.withExactQuery(
				'?$filter=startswith(uuid,%2727fda508c%27)&$select=device_name,id,overall_status,is_online,ip_address,mac_address,last_connectivity_event,uuid,supervisor_version,is_web_accessible,note,os_version,memory_usage,memory_total,public_address,storage_block_device,storage_usage,storage_total,cpu_usage,cpu_temp,cpu_id,is_undervolted&$expand=belongs_to__application($select=app_name,slug),is_of__device_type($select=slug),is_running__release($select=commit)',
			)
			.thenReply(
				200,
				await import('fs').then((fs) =>
					fs.readFileSync(
						path.join(apiResponsePath, 'device-missing-app.json'),
						'utf8',
					),
				),
				{
					'Content-Type': 'application/json',
				},
			);

		const { out } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		expect(lines).to.have.lengthOf(25);
		expect(lines[0]).to.equal('== SPARKLING WOOD');
		expect(lines[6].split(':')[1].trim()).to.equal('N/a');
	});

	it('outputs device as JSON with the -j/--json flag', async () => {
		await server.mockttp
			.forGet('/v7/device')
			.withExactQuery(
				'?$filter=startswith(uuid,%2727fda508c%27)&$expand=device_tag($select=tag_key,value),belongs_to__application($select=app_name,slug),is_of__device_type($select=slug),is_running__release($select=commit)',
			)
			.thenReply(
				200,
				await import('fs').then((fs) =>
					fs.readFileSync(path.join(apiResponsePath, 'device.json'), 'utf8'),
				),
				{
					'Content-Type': 'application/json',
				},
			);

		await server.mockttp
			.forGet('/v7/device')
			.withExactQuery(
				'?$filter=startswith(uuid,%2727fda508c%27)&$select=overall_status,overall_progress,should_be_running__release',
			)
			.thenReply(
				200,
				await import('fs').then((fs) =>
					fs.readFileSync(path.join(apiResponsePath, 'device.json'), 'utf8'),
				),
				{
					'Content-Type': 'application/json',
				},
			);

		const { out, err } = await runCommand('device 27fda508c --json');
		expect(err).to.be.empty;
		const json = JSON.parse(out.join(''));
		expect(json.device_name).to.equal('sparkling-wood');
		expect(json.belongs_to__application[0].app_name).to.equal('test app');
		expect(json.device_tag[0].tag_key).to.equal('example');
	});

	it('should list devices from own and collaborator apps', async () => {
		await server.mockttp
			.forGet('/v7/device')
			.withExactQuery(
				'?$select=id,uuid,device_name,status,is_online,supervisor_version,os_version&$expand=belongs_to__application($select=app_name,slug),is_of__device_type($select=slug),is_running__release($select=commit)&$orderby=device_name%20asc',
			)
			.thenReply(
				200,
				await import('fs').then((fs) =>
					fs.readFileSync(path.join(apiResponsePath, 'devices.json'), 'utf8'),
				),
				{
					'Content-Type': 'application/json',
				},
			);

		const { out } = await runCommand('device list');

		const lines = cleanOutput(out);

		expect(lines[0].replace(/  +/g, ' ')).to.equal(
			'ID UUID DEVICE NAME DEVICE TYPE FLEET STATUS IS ONLINE SUPERVISOR VERSION OS VERSION DASHBOARD URL',
		);
		expect(lines).to.have.lengthOf.at.least(2);

		expect(lines.some((l) => l.includes('org/test app'))).to.be.true;

		// Devices with missing applications will have application name set to `N/a`.
		// e.g. When user has a device associated with app that user is no longer a collaborator of.
		expect(lines.some((l) => l.includes('N/a'))).to.be.true;
	});
});
