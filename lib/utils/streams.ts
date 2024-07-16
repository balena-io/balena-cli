/**
 * @license
 * Copyright 2019 Balena Ltd.
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
import fs from 'fs';

export async function buffer(
	stream: NodeJS.ReadableStream,
	bufferFile: string,
): Promise<NodeJS.ReadableStream> {
	const fileWriteStream = fs.createWriteStream(bufferFile);

	return new Promise(function (resolve, reject) {
		stream.on('error', reject).on('end', resolve).pipe(fileWriteStream);
	}).then(
		() =>
			new Promise(function (resolve, reject) {
				const fstream = fs.createReadStream(bufferFile);

				fstream.on('open', () => resolve(fstream)).on('error', reject);
			}),
	);
}
