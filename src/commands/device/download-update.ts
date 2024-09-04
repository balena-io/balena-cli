import { Flags, Args } from '@oclif/core';
import Command from '../../command';
import { stripIndent } from '../../utils/lazy';
import * as cf from '../../utils/common-flags';

import { downloadUpdateBundle } from '../../utils/download-update';

export default class DeviceDownloadUpdateCmd extends Command {
	public static description = stripIndent`
		Downloads a device local update bundle.
	`;

	public static examples = ['$ balena device download-update fd3a6a1,e573ad5'];

	public static args = {
		uuids: Args.string({
			description: 'comma-separated list (no blank spaces) of device UUIDs',
			required: true,
		}),
	};

	public static usage = 'device download-update <uuid(s)>';

	public static flags = {
		output: Flags.string({
			description: 'output path',
			char: 'o',
			required: true,
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(
			DeviceDownloadUpdateCmd,
		);

		// TODO: support UUIDs passed through stdin pipe

		await downloadUpdateBundle(params.uuids, options.output);
	}
}
