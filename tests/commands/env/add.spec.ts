import { expect } from 'chai';
import { balenaAPIMock, runCommand } from '../../helpers';

describe('balena env add', function() {
	it('should successfully add an environment variable', async () => {
		const deviceId = 'f63fd7d7812c34c4c14ae023fdff05f5';
		const mock = balenaAPIMock();
		mock
			.get(/device/)
			.reply(201, {
				d: [
					{
						id: 1031543,
						__metadata: { uri: '/resin/device(@id)?@id=1031543' },
					},
				],
			})
			.post(/device_environment_variable/)
			.reply(200, 'OK');

		const { out, err } = await runCommand(`env add TEST 1 -d ${deviceId}`);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');

		// @ts-ignore
		mock.remove();
	});
});
