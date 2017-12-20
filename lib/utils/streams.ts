import { ReadStream } from 'fs';

export async function buffer(stream: NodeJS.ReadableStream, bufferFile: string) {
	const Promise = await import('bluebird');
	const fs = await import('fs');

	const fileWriteStream = fs.createWriteStream(bufferFile);

	return new Promise(function(resolve, reject) {
		return stream
		.on('error', reject)
		.on('end', resolve)
		.pipe(fileWriteStream);
	}).then(() => new Promise(function(resolve, reject) {
		fs.createReadStream(bufferFile)
		.on('open', function(this: ReadStream) {
			resolve(this);
		}).on('error', reject);
	}));
};
