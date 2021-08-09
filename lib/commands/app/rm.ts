/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { flags } from '@oclif/command';
import type { Output as ParserOutput } from '@oclif/parser';

import Command from '../../command';
import * as cf from '../../utils/common-flags';
import * as ca from '../../utils/common-args';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import {
	applicationIdInfo,
	appToFleetCmdMsg,
	warnify,
} from '../../utils/messages';

interface FlagsDef {
	yes: boolean;
	help: void;
}

interface ArgsDef {
	fleet: string;
}

export class FleetRmCmd extends Command {
	public static description = stripIndent`
		Remove a fleet.

		Permanently remove a fleet.

		The --yes option may be used to avoid interactive confirmation.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena fleet rm MyFleet',
		'$ balena fleet rm MyFleet --yes',
		'$ balena fleet rm myorg/myfleet',
	];

	public static args = [ca.fleetRequired];

	public static usage = 'fleet rm <fleet>';

	public static flags: flags.Input<FlagsDef> = {
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run(parserOutput?: ParserOutput<FlagsDef, ArgsDef>) {
		const { args: params, flags: options } =
			parserOutput || this.parse<FlagsDef, ArgsDef>(FleetRmCmd);

		const { confirm } = await import('../../utils/patterns');
		const { getApplication } = await import('../../utils/sdk');
		const balena = getBalenaSdk();

		// Confirm
		await confirm(
			options.yes ?? false,
			`Are you sure you want to delete fleet ${params.fleet}?`,
		);

		// Disambiguate application (if is a number, it could either be an ID or a numerical name)
		const application = await getApplication(balena, params.fleet);

		// Remove
		await balena.models.application.remove(application.id);
	}
}

export default class AppRmCmd extends FleetRmCmd {
	public static description = stripIndent`
		DEPRECATED alias for the 'fleet rm' command

		${appToFleetCmdMsg
			.split('\n')
			.map((l) => `\t\t${l}`)
			.join('\n')}

		For command usage, see 'balena help fleet rm'
	`;
	public static examples = [];
	public static usage = 'app rm <fleet>';
	public static args = FleetRmCmd.args;
	public static flags = FleetRmCmd.flags;
	public static authenticated = FleetRmCmd.authenticated;
	public static primary = FleetRmCmd.primary;

	public async run() {
		// call this.parse() before deprecation message to parse '-h'
		const parserOutput = this.parse<FlagsDef, ArgsDef>(AppRmCmd);
		if (process.stderr.isTTY) {
			console.error(warnify(appToFleetCmdMsg));
		}
		await super.run(parserOutput);
	}
}
