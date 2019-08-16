import * as chai from 'chai';
import * as fs from 'fs';
import { runCommand } from '../helpers';

const packageJSON = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const nodeVersion = process.version.startsWith('v')
	? process.version.slice(1)
	: process.version;

describe('balena version', function() {
	it('should print the installed version of the CLI', async () => {
		const { out } = await runCommand('version');

		chai.expect(out.join('')).to.equal(`${packageJSON.version}\n`);
	});

	it('should print additional version information with the -a flag', async () => {
		const { out } = await runCommand('version -a');

		chai.expect(out.join('')).to.equal(
			`balena-cli version "${packageJSON.version}"
Node.js version "${nodeVersion}"
`,
		);
	});

	it('should print version information as JSON with the the -j flag', async () => {
		const { out } = await runCommand('version -j');

		const json = JSON.parse(out.join(''));

		chai.expect(json).to.deep.equal({
			'balena-cli': packageJSON.version,
			'Node.js': nodeVersion,
		});
	});
});
