import * as fs from 'fs';
import * as path from 'path';
import type * as stream from 'stream';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';

import * as bundle from '@balena/update-bundle';

import { getBalenaSdk } from './lazy';

enum UpdateBundleFormat {
	CompressedTar,
	Tar,
}

export async function downloadUpdateBundle(uuids: string, output: string) {
	const balena = getBalenaSdk();

	const deviceUuids = await deviceUuidsFromParam(balena, uuids);

	const subject = (await balena.auth.getUserInfo()).username;
	const token = await balena.auth.getToken();

	const updateBundleStream = await bundle.create({
		type: 'Device',
		deviceUuids,
		auth: {
			scheme: 'Bearer',
			subject,
			token,
		},
	});

	// TODO: accept fleet arguments for download update bundle as well
	/*
    const updateBundleStream = await bundle.create({
        type: 'Fleet',
        appUuid: 'f48afafee22245209acfbaf4c2b482e8',
        releaseUuid: '65a9cb86a59fbe58430715a3d687ea68',
        auth: {
            scheme: 'Bearer',
            subject,
            token,
        },
    });
    */

	await saveBundle(updateBundleStream, output);
}

async function saveBundle(
	updateBundleStream: stream.Readable,
	filePath: string,
) {
	const target = fs.createWriteStream(filePath);

	const format = getUpdateBundleFormat(filePath);

	if (format === UpdateBundleFormat.CompressedTar) {
		const gzip = zlib.createGzip();

		await pipeline(updateBundleStream, gzip, target);
	} else {
		await pipeline(updateBundleStream, target);
	}
}

function getUpdateBundleFormat(filePath: string): UpdateBundleFormat {
	const ext = getCompoundExtension(filePath);

	if (ext === '.tar.gz' || ext === '.tgz') {
		return UpdateBundleFormat.CompressedTar;
	} else if (ext === '.tar') {
		return UpdateBundleFormat.Tar;
	} else {
		throw new Error(`Unsupported file extension: ${ext}`);
	}
}

function getCompoundExtension(filePath: string): string {
	let compoundExt = '';
	let currentPath = filePath;

	for (;;) {
		const ext = path.extname(currentPath);
		if (ext === '') {
			break;
		}
		compoundExt = ext + compoundExt;
		currentPath = path.basename(currentPath, ext);
	}

	return compoundExt;
}

async function deviceUuidsFromParam(
	balena: ReturnType<typeof getBalenaSdk>,
	uuids: string,
): Promise<string[]> {
	const uuidsList = uuids.split(',');

	const deviceUuids = [];
	for (const uuid of uuidsList) {
		try {
			const device = await balena.models.device.get(uuid);
			deviceUuids.push(device.uuid);
		} catch (err) {
			// TODO: Needs proper error handling
			throw new Error(`UUID error ${uuid}: ${err.message}`);
		}
	}

	return deviceUuids;
}
