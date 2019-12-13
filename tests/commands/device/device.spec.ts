import { expect } from 'chai';
import { BalenaAPIMock } from '../../balena-api-mock';
import { cleanOutput, runCommand } from '../../helpers';

const HELP_RESPONSE = `
Usage: device <uuid>

Use this command to show information about a single device.

Examples:

\t$ balena device 7cf02a6
`;

describe('balena device', function() {
	let api: BalenaAPIMock;

	beforeEach(() => {
		api = new BalenaAPIMock();
	});

	afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	it('should print help text with the -h flag', async () => {
		api.expectWhoAmI();
		api.expectMixpanel();

		const { out, err } = await runCommand('device -h');

		expect(cleanOutput(out)).to.deep.equal(cleanOutput([HELP_RESPONSE]));

		expect(err).to.eql([]);
	});

	it.skip('should error if uuid not provided', async () => {
		// TODO: Figure out how to test for expected errors with current setup
		//  including exit codes if possible.
		api.expectWhoAmI();
		api.expectMixpanel();

		const { out, err } = await runCommand('device');
		const errLines = cleanOutput(err);

		expect(errLines[0]).to.equal('Missing uuid');
		expect(out).to.eql([]);
	});

	it('should list device details for provided uuid', async () => {
		api.expectWhoAmI();
		api.expectMixpanel();

		api.scope
			.get(/^\/v5\/device/)
			.replyWithFile(200, __dirname + '/device.api-response.json', {
				'Content-Type': 'application/json',
			});

		const { out, err } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		expect(lines).to.have.lengthOf(13);
		expect(lines[0]).to.equal('== SPARKLING WOOD');
		expect(lines[6].split(':')[1].trim()).to.equal('test app');

		expect(err).to.eql([]);
	});

	it('correctly handles devices with missing application', async () => {
		// Devices with missing applications will have application name set to `N/a`.
		// e.g. When user has a device associated with app that user is no longer a collaborator of.
		api.expectWhoAmI();
		api.expectMixpanel();

		api.scope
			.get(/^\/v5\/device/)
			.replyWithFile(200, __dirname + '/device.api-response.missing-app.json', {
				'Content-Type': 'application/json',
			});

		const { out, err } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		expect(lines).to.have.lengthOf(13);
		expect(lines[0]).to.equal('== SPARKLING WOOD');
		expect(lines[6].split(':')[1].trim()).to.equal('N/a');

		expect(err).to.eql([]);
	});
});
