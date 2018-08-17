/*
Copyright 2016-2017 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { CommandDefinition } from 'capitano';
import { ResinSDK } from 'resin-sdk';
import { stripIndent } from 'common-tags';

async function getAppOwner(sdk: ResinSDK, appName: string) {
	const {
		exitWithExpectedError,
		selectFromList,
	} = await import('../utils/patterns');
	const _ = await import('lodash');

	const applications = await sdk.models.application.getAll({
		$expand: {
			user: {
				$select: ['username'],
			},
		},
		$filter: {
			app_name: appName,
		},
		$select: ['id'],
	});

	if (applications == null || applications.length === 0) {
		exitWithExpectedError(
			stripIndent`
			No applications found with name: ${appName}.

			This could mean that the application does not exist, or you do
			not have the permissions required to access it.`,
		);
	}

	if (applications.length === 1) {
		return _.get(applications, '[0].user[0].username');
	}

	// If we got more than one application with the same name it means that the
	// user has access to a collab app with the same name as a personal app. We
	// present a list to the user which shows the fully qualified application
	// name (user/appname) and allows them to select
	const entries = _.map(applications, app => {
		const username = _.get(app, 'user[0].username');
		return {
			name: `${username}/${appName}`,
			extra: username,
		};
	});

	const selected = await selectFromList(
		`${
			entries.length
		} applications found with that name, please select the application you would like to push to`,
		entries,
	);

	return selected.extra;
}

export const push: CommandDefinition<
	{
		application: string;
	},
	{
		source: string;
		emulated: boolean;
		nocache: boolean;
	}
> = {
	signature: 'push <application>',
	description: 'Start a remote build on the resin.io cloud build servers',
	help: stripIndent`
		This command can be used to start a build on the remote
		resin.io cloud builders. The given source directory will be sent to the
		resin.io builder, and the build will proceed. This can be used as a drop-in
		replacement for git push to deploy.

		Examples:

			$ resin push myApp
			$ resin push myApp --source <source directory>
			$ resin push myApp -s <source directory>
	`,
	permission: 'user',
	options: [
		{
			signature: 'source',
			alias: 's',
			description:
				'The source that should be sent to the resin builder to be built (defaults to the current directory)',
			parameter: 'source',
		},
		{
			signature: 'emulated',
			alias: 'e',
			description: 'Force an emulated build to occur on the remote builder',
			boolean: true,
		},
		{
			signature: 'nocache',
			alias: 'c',
			description: "Don't use cache when building this project",
			boolean: true,
		},
	],
	async action(params, options, done) {
		const sdk = (await import('resin-sdk')).fromSharedOptions();
		const Bluebird = await import('bluebird');
		const remote = await import('../utils/remote-build');
		const { exitWithExpectedError } = await import('../utils/patterns');

		const app: string | null = params.application;
		if (app == null) {
			exitWithExpectedError('You must specify an application');
		}

		const source = options.source || '.';
		if (process.env.DEBUG) {
			console.log(`[debug] Using ${source} as build source`);
		}

		Bluebird.join(
			sdk.auth.getToken(),
			sdk.settings.get('resinUrl'),
			getAppOwner(sdk, app),
			(token, baseUrl, owner) => {
				const opts = {
					emulated: options.emulated,
					nocache: options.nocache,
				};
				const args = {
					app,
					owner,
					source,
					auth: token,
					baseUrl,
					sdk,
					opts,
				};

				return remote.startRemoteBuild(args);
			},
		)
		.catch(remote.RemoteBuildFailedError, exitWithExpectedError)
		.nodeify(done);
	},
};
