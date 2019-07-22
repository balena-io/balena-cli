import * as Capitano from 'capitano';

import _ = require('lodash');
import Mixpanel = require('mixpanel');
import Raven = require('raven');
import Promise = require('bluebird');
import ResinSdk = require('resin-sdk');
import packageJSON = require('../package.json');

const resin = ResinSdk.fromSharedOptions();
const getMatchCommandAsync = Promise.promisify(Capitano.state.getMatchCommand);
const getMixpanel = _.memoize<any>(() =>
	resin.models.config
		.getAll()
		.get('mixpanelToken')
		.then(Mixpanel.init),
);

export function trackCommand(capitanoCli: Capitano.Cli) {
	return Promise.props({
		resinUrl: resin.settings.get('resinUrl'),
		username: resin.auth.whoami().catchReturn(undefined),
		mixpanel: getMixpanel(),
	})
		.then(({ username, resinUrl, mixpanel }) => {
			return getMatchCommandAsync(capitanoCli.command).then(command => {
				Raven.mergeContext({
					user: {
						id: username,
						username,
					},
				});
				// `command.signature.toString()` results in a string like, for example:
				//     "push <applicationOrDevice>"
				// That's literally so: "applicationOrDevice" is NOT replaced with
				// the actual application ID or device ID. The purpose is find out the
				// most / least used command verbs, so we can focus our development
				// effort where it is most beneficial to end users.
				return mixpanel.track(`[CLI] ${command.signature.toString()}`, {
					distinct_id: username,
					version: packageJSON.version,
					node: process.version,
					arch: process.arch,
					resinUrl,
					platform: process.platform,
				});
			});
		})
		.timeout(100)
		.catchReturn(undefined);
}
