/**
 * @license
 * Copyright 2025 Balena Ltd.
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

// Utilities to explore the contents in a balenaOS image.

import * as imagefs from 'balena-image-fs';
import * as filedisk from 'file-disk';
import { getPartitions } from 'partitioninfo';
import type * as Fs from 'fs';

/**
 * @summary IDs for the standard balenaOS partitions
 * @description Values are the base name for a partition on disk
 */
export enum BalenaPartition {
	BOOT = 'boot',
	ROOTA = 'rootA',
	ROOTB = 'rootB',
	STATE = 'state',
	DATA = 'data',
}

/**
 * @summary Allow a provided function to explore the contents of one of the well-known
 * partitions of a balenaOS image
 *
 * @param {string} imagePath - pathname of image for search
 * @param {BalenaPartition} partitionId - partition to find
 * @param {(fs) => Promise<T>} - function for exploration
 * @returns {T}
 */
export async function explorePartition<T>(
	imagePath: string,
	partitionId: BalenaPartition,
	exploreFn: (fs: typeof Fs) => Promise<T>,
): Promise<T> {
	return await filedisk.withOpenFile(imagePath, 'r', async (handle) => {
		const disk = new filedisk.FileDisk(handle, true, false, false);
		const partitionInfo = await getPartitions(disk, {
			includeExtended: false,
			getLogical: true,
		});

		const findResult = await imagefs.findPartition(disk, partitionInfo, [
			`resin-${partitionId}`,
			`flash-${partitionId}`,
			`balena-${partitionId}`,
		]);
		if (findResult == null) {
			throw new Error(`Can't find partition for ${partitionId}`);
		}

		return await imagefs.interact<T>(disk, findResult.index, exploreFn);
	});
}
