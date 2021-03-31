import { expect } from 'chai';
import { promises as fs } from 'fs';
import * as process from 'process';
import { runCommand } from '../../helpers';
import { promisify } from 'util';
import * as tmp from 'tmp';

tmp.setGracefulCleanup();
const tmpNameAsync = promisify(tmp.tmpName);

import { BalenaAPIMock } from '../../balena-api-mock';

if (process.platform !== 'win32') {
	describe('balena os configure', function () {
		let api: BalenaAPIMock;
		let tmpPath: string;

		beforeEach(async () => {
			api = new BalenaAPIMock();
			api.expectGetWhoAmI({ optional: true, persist: true });
			api.expectGetMixpanel({ optional: true });
			tmpPath = (await tmpNameAsync()) as string;
			await fs.copyFile('./tests/test-data/dummy.img', tmpPath);
		});

		afterEach(async () => {
			api.done();
			await fs.unlink(tmpPath);
		});

		it('should inject a valid config.json file', async () => {
			api.expectGetApplication();
			api.expectGetDeviceTypes();
			api.expectDownloadConfig();
			api.expectApplicationProvisioning();

			const command: string[] = [
				`os configure ${tmpPath}`,
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
			const imagefs = await import('balena-image-fs');
			const config = await imagefs.interact(tmpPath, 1, async (_fs) => {
				return await promisify(_fs.readFile)('/config.json');
			});
			expect(config).to.not.be.empty;

			// confirm the image has the correct config.json values...
			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.have.property('deviceType', 'raspberrypi3');
			expect(configObj).to.have.property('initialDeviceName', 'testDeviceName');
		});
	});
}
