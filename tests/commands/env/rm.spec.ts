import * as chai from 'chai';
import { balenaAPIMock, runCommand } from '../../helpers';

describe('balena env rm', function() {
	it('should successfully delete an environment variable', async () => {
		const mock = balenaAPIMock();
		mock.delete(/device_environment_variable/).reply(200, 'OK');

		const { out, err } = await runCommand('env rm 144690 -d -y');

		chai.expect(out.join('')).to.equal('');
		chai.expect(err.join('')).to.equal('');

		// @ts-ignore
		mock.remove();
	});
});
