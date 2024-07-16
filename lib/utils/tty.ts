/**
 * @license
 * Copyright 2018-2021 Balena Ltd.
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
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const windowSize: { width?: number; height?: number } = {};

const updateWindowSize = () => {
	const size = require('window-size')?.get();
	windowSize.width = size?.width;
	windowSize.height = size?.height;
};

process.stdout.on('resize', updateWindowSize);

export default (stream: NodeJS.WriteStream = process.stdout) => {
	// make sure we get initial metrics
	updateWindowSize();

	const currentWindowSize = () => {
		// always return a copy.
		// width/height can be undefined if no TTY.
		return {
			width: windowSize.width,
			height: windowSize.height,
		};
	};

	const hideCursor = () => stream.write('\u001B[?25l');

	const showCursor = () => stream.write('\u001B[?25h');

	const cursorUp = (rows: number = 0) => stream.write(`\u001B[${rows}A`);

	const cursorDown = (rows: number = 0) => stream.write(`\u001B[${rows}B`);

	const write = (str: string) => stream.write(str);

	const writeLine = (str: string) => stream.write(`${str}\n`);

	const clearLine = () => stream.write('\u001B[2K\r');

	const replaceLine = (str: string) => {
		clearLine();
		return write(str);
	};

	const deleteToEnd = () => stream.write('\u001b[0J');

	return {
		stream,
		currentWindowSize,
		hideCursor,
		showCursor,
		cursorUp,
		cursorDown,
		write,
		writeLine,
		clearLine,
		replaceLine,
		deleteToEnd,
	};
};
