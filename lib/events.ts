import * as Capitano from 'capitano';

import _ = require('lodash');
import { core as Analytics } from 'analytics.node';
import { mixpanelIntegration } from 'analytics.node';
import { sentryIntegration } from 'analytics.node';
import Promise = require('bluebird');
import ResinSdk = require('resin-sdk');
import packageJSON = require('../package.json');
Analytics.addIntegration(sentryIntegration);

const resin = ResinSdk.fromSharedOptions();
const getMatchCommandAsync = Promise.promisify(Capitano.state.getMatchCommand);
const getAnalyticsInstance = _.memoize<any>(() =>
	resin.models.config
		.getAll()
		.get('mixpanelToken')
		.then(token => {
			Analytics.addIntegration(mixpanelIntegration);
			const options = { token: token };
			Analytics.initialize({ Mixpanel: options });
		}),
);

export function trackCommand(capitanoCli: Capitano.Cli) {
	return Promise.props({
		resinUrl: resin.settings.get('resinUrl'),
		username: resin.auth.whoami().catchReturn(undefined),
		analytics: getAnalyticsInstance(),
	})
		.then(({ username, resinUrl, analytics }) => {
			return getMatchCommandAsync(capitanoCli.command).then(command => {
				Analytics.mergeContext({
					user: {
						id: username,
						username,
					},
				});

				return analytics.track(`[CLI] ${command.signature.toString()}`, {
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
