import * as Capitano from 'capitano';

import _ = require('lodash');
import Mixpanel = require('mixpanel');
import Raven = require('raven');
import Promise = require('bluebird');
import { resin } from './sdk';
import packageJSON = require('../package.json');

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

				return mixpanel.track(`[CLI] ${command.signature.toString()}`, {
					distinct_id: username,
					argv: process.argv.join(' '),
					version: packageJSON.version,
					node: process.version,
					arch: process.arch,
					resinUrl,
					platform: process.platform,
					command: capitanoCli,
				});
			});
		})
		.timeout(100)
		.catchReturn(undefined);
}
