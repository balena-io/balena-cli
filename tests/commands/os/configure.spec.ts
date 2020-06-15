import { expect } from 'chai';
import * as fs from 'mz/fs';
import * as process from 'process';
import { runCommand } from '../../helpers';

import { BalenaAPIMock } from '../../balena-api-mock';

if (process.platform !== 'win32') {
	describe('balena os configure', function () {
		let api: BalenaAPIMock;

		beforeEach(async () => {
			api = new BalenaAPIMock();
			api.expectGetWhoAmI({ optional: true, persist: true });
			api.expectGetMixpanel({ optional: true });
			await fs.copyFile('./tests/test-data/dummy.img', '/tmp/dummy.img');
		});

		afterEach(async () => {
			api.done();
			await fs.unlink('/tmp/dummy.img');
		});

		it('should inject a valid config.json file', async () => {
			api.expectGetApplication();
			api.expectGetDeviceTypes();
			api.expectDownloadConfig();
			api.expectApplicationProvisioning();

			const command: string[] = [
				'os configure /tmp/dummy.img',
				'--device-type raspberrypi3',
				'--version 2.47.0+rev1',
				'--application testApp',
				'--config-app-update-poll-interval 10',
				'--config-network ethernet',
				'--initial-device-name testDeviceName',
			];

			const { err } = await runCommand(command.join(' '));
			expect(err.join('')).to.equal('');

			// confirm the image contains a config.json...
			const imagefs = await require('resin-image-fs');
			const config = await imagefs.readFile({
				image: '/tmp/dummy.img',
				partition: 1,
				path: '/config.json',
			});
			expect(config).to.not.be.empty;

			// confirm the image has the correct config.json values...
			const configObj = JSON.parse(config);
			expect(configObj).to.have.property('deviceType', 'raspberrypi3');
			expect(configObj).to.have.property('initialDeviceName', 'testDeviceName');
		});
	});
}
