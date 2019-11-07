import { expect } from 'chai';
import * as _ from 'lodash';
import { runCommand } from '../../helpers';

const HELP = `
Usage: devices supported

Use this command to get the list of all supported devices.

Examples:

\t$ balena devices supported
`;

const cleanOutput = (output: string[] | string) => {
	return _(_.castArray(output))
		.map(log => {
			return log.split('\n').map(line => {
				return line.trim();
			});
		})
		.flatten()
		.compact()
		.value();
};

describe('balena devices supported', function() {
	it('should list currently supported devices', async () => {
		const { out, err } = await runCommand('devices supported');

		const lines = cleanOutput(out);

		expect(lines[0].replace(/  +/g, ' ')).to.equal('SLUG NAME');
		expect(lines).to.have.lengthOf.at.least(2);
		expect(lines.some(l => l.includes('DISCONTINUED'))).to.be.false;

		expect(err).to.have.lengthOf(0);
	});

	it('should print help text with the -h flag', async () => {
		const { out, err } = await runCommand('devices supported -h');

		expect(cleanOutput(out)).to.deep.equal(cleanOutput([HELP]));

		expect(err).to.have.lengthOf(0);
	});
});
