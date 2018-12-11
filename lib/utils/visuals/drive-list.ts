import chalk from 'chalk';
import * as sdk from 'etcher-sdk';

import { CustomDynamicList } from './custom-dynamic-list';

export class DriveList extends CustomDynamicList<
	sdk.sourceDestination.BlockDevice
> {
	constructor(private scanner: sdk.scanner.Scanner) {
		super(
			'Select a drive',
			`${chalk.red('x')} No available drives were detected, plug one in!`,
		);
		const refresh = this.refresh.bind(this);
		scanner.on('attach', refresh);
		scanner.on('detach', refresh);
	}

	protected *getThings() {
		for (const drive of this.scanner.drives) {
			if (drive instanceof sdk.sourceDestination.BlockDevice) {
				yield drive;
			}
		}
	}

	protected format(drive: sdk.sourceDestination.BlockDevice) {
		const size = drive.size / 1e9;
		return `${drive.device} (${size.toFixed(1)} GB) - ${drive.description}`;
	}
}
