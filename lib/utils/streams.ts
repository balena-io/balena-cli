import Promise = require('bluebird');
import fs = require('fs');

export function buffer(
	stream: NodeJS.ReadableStream,
	bufferFile: string,
): Promise<NodeJS.ReadableStream> {
	const fileWriteStream = fs.createWriteStream(bufferFile);

	return new Promise(function(resolve, reject) {
		stream
			.on('error', reject)
			.on('end', resolve)
			.pipe(fileWriteStream);
	}).then(
		() =>
			new Promise(function(resolve, reject) {
				const stream = fs.createReadStream(bufferFile);

				stream.on('open', () => resolve(stream)).on('error', reject);
			}),
	);
}
