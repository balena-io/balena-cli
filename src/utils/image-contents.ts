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
import type {
	GetPartitionsResult,
	GPTPartition,
	MBRPartition,
} from 'partitioninfo';
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
 * @description Presently assumes partition is rootA
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
		const { partitions } = partitionInfo;

		// Some devices like Intel Edison have an empty partition table, which
		// we designate by leaving partNumber undefined. The balena-image-fs
		// interact() function knows how to handle this case.
		let partNumber;
		if (partitions?.length) {
			const innerPartNumber = await findPartition(partitionInfo, disk, [
				`resin-${partitionId}`,
				`flash-${partitionId}`,
				`balena-${partitionId}`,
			]);
			if (innerPartNumber === undefined) {
				throw new Error("can't find partition");
			} else {
				partNumber = innerPartNumber;
			}
		}

		return await imagefs.interact<T>(disk, partNumber, exploreFn);
	});
}

// Find partition, by partition name on GPT or by filesystem label on MBR.
async function findPartition(
	partitionInfo: GetPartitionsResult,
	fileDisk: filedisk.FileDisk,
	names: string[],
): Promise<number | undefined> {
	const { partitions } = partitionInfo;
	const isGPT = (
		partsInfo: GetPartitionsResult,
		_parts: Array<GPTPartition | MBRPartition>,
	): _parts is GPTPartition[] => partsInfo.type === 'gpt';

	if (isGPT(partitionInfo, partitions)) {
		const partition = partitions.find((gptPartInfo: GPTPartition) =>
			names.includes(gptPartInfo.name),
		);
		if (partition && typeof partition.index === 'number') {
			return partition.index;
		}
	} else {
		// MBR
		for (const partition of partitions) {
			try {
				const label = await imagefs.getFsLabel(fileDisk, partition);
				if (names.includes(label) && typeof partition.index === 'number') {
					return partition.index;
				}
			} catch (e) {
				// LabelNotFound is expected and not fatal.
				if (!(e instanceof imagefs.LabelNotFound)) {
					throw e;
				}
			}
		}
	}
	return undefined;
}
