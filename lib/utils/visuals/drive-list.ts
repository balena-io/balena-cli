import * as _sdk from 'etcher-sdk';

import { getChalk } from '../lazy';
import { CustomDynamicList } from './custom-dynamic-list';

export class DriveList extends CustomDynamicList<
	_sdk.sourceDestination.BlockDevice
> {
	constructor(private scanner: _sdk.scanner.Scanner) {
		super(
			'Select a drive',
			`${getChalk().red('x')} No available drives were detected, plug one in!`,
		);
		const refresh = this.refresh.bind(this);
		scanner.on('attach', refresh);
		scanner.on('detach', refresh);
	}

	protected *getThings() {
		const sdk: typeof _sdk = require('etcher-sdk');
		for (const drive of this.scanner.drives) {
			if (drive instanceof sdk.sourceDestination.BlockDevice) {
				yield drive;
			}
		}
	}

	protected format(drive: _sdk.sourceDestination.BlockDevice) {
		const size =
			drive.size != null
				? `${(drive.size / 1e9).toFixed(1).toString()} GB`
				: 'Unknown size';
		return `${drive.device} (${size}) - ${drive.description}`;
	}
}
