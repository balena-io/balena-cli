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

import { flags } from '@oclif/command';
import type { IArg } from '@oclif/parser/lib/args';
import { ImageInstall } from 'balena-sdk';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { getExpandedProp } from '../../utils/pine';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	uuid: string;
}

interface AugmentedImageInstall extends ImageInstall {
	name?: string;
	release?: string;
}

export default class DeviceServicesCmd extends Command {
	public static description = stripIndent`
         Show info about a device's services.
 
         Show info about a device's services.
         `;
	public static examples = ['$ balena device services 23c73a1'];

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description: 'the uuid of the device whose services to show info about',
			required: true,
		},
	];

	public static usage = 'device services <uuid>';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(DeviceServicesCmd);

		const balena = getBalenaSdk();

		try {
			const device = await balena.models.device.getWithServiceDetails(
				params.uuid,
			);
			console.log(
				getVisuals().table.horizontal(
					device.image_install?.map((imageInstall) => {
						const newImageInstall: AugmentedImageInstall = { ...imageInstall };
						newImageInstall.name = getExpandedProp(
							getExpandedProp(imageInstall.image, 'is_a_build_of__service')!,
							'service_name',
						);
						newImageInstall.release = getExpandedProp(
							imageInstall.is_provided_by__release,
							'commit',
						);
						return newImageInstall;
					}),
					['name', 'status', 'release', 'id'],
				),
			);
		} catch (e) {
			throw e;
		}
	}
}
