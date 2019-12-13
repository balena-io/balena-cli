import { expect } from 'chai';
import { BalenaAPIMock } from '../../balena-api-mock';
import { cleanOutput, runCommand } from '../../helpers';

const HELP_MESSAGE = `
Usage: app create <name>

Use this command to create a new balena application.

You can specify the application device type with the \`--type\` option.
Otherwise, an interactive dropdown will be shown for you to select from.

You can see a list of supported device types with

\t$ balena devices supported

Examples:

\t$ balena app create MyApp
\t$ balena app create MyApp --type raspberry-pi

Options:

    --type, -t <type>                   application device type (Check available types with \`balena devices supported\`)
`;

describe('balena app create', function() {
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

		const { out, err } = await runCommand('app create -h');

		expect(cleanOutput(out)).to.deep.equal(cleanOutput([HELP_MESSAGE]));

		expect(err).to.eql([]);
	});
});
