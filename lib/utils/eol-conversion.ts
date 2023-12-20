/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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

import { promises as fs } from 'fs';
import Logger from './logger.js';

const globalLogger = Logger.getLogger();

// Define file size threshold (bytes) over which analysis/conversion is not performed.
const LARGE_FILE_THRESHOLD = 10 * 1000 * 1000;

// Note that `convertEolInPlace()` only works with UTF-8 or single-byte encodings
const CONVERTIBLE_ENCODINGS = ['ascii', 'utf-8'];

// Maximum number of bytes to consider when detecting the file encoding
const DETECT_MAX_BYTES = 1024;

/**
 * Convert EOL (CRLF → LF) in place, i.e. modifying the input buffer.
 * Safe for UTF-8, ASCII and 8-bit encodings (like 'latin-1', 'iso-8859-1', ...),
 * but not safe for UTF-16 or UTF-32.
 * Return a new buffer object sharing the same contents memory space as the
 * input buffer (using Buffer.slice()), in order to safely reflect the new
 * buffer size.
 * @param buf
 */
export function convertEolInPlace(buf: Buffer): Buffer {
	const CR = 13;
	const LF = 10;
	let foundCR = false;
	let j;
	// Algorithm gist:
	// - i and j are running indexes over the same buffer, but think of it as
	//   i pointing to the input buffer, and j pointing to the output buffer.
	// - i and j are incremented by 1 in every loop iteration, but if a LF is found
	//   after a CR, then j is decremented by 1, and LF is written. Invariant: j <= i.
	for (let i = (j = 0); i < buf.length; i++, j++) {
		const b = (buf[j] = buf[i]);
		if (b === CR) {
			foundCR = true;
		} else {
			if (foundCR && b === LF) {
				j--; // decrement index of "output buffer"
				buf[j] = LF; // overwrite previous CR with LF
			}
			foundCR = false;
		}
	}
	return buf.slice(0, j);
}

/**
 * Drop-in replacement for promisified fs.readFile(<string>)
 * Attempts to convert EOLs from CRLF to LF for supported encodings,
 * or otherwise logs warnings.
 * @param filepath
 * @param convertEol When true, performs conversions, otherwise just warns.
 */
export async function readFileWithEolConversion(
	filepath: string,
	convertEol: boolean,
): Promise<Buffer> {
	const fileBuffer = await fs.readFile(filepath);

	// Skip processing of very large files
	const fileStats = await fs.stat(filepath);
	if (fileStats.size > LARGE_FILE_THRESHOLD) {
		globalLogger.logWarn(`CRLF detection skipped for large file: ${filepath}`);
		return fileBuffer;
	}

	// Analyse encoding
	const encoding = await detectEncoding(fileBuffer);

	// Skip further processing of non-convertible encodings
	if (!CONVERTIBLE_ENCODINGS.includes(encoding)) {
		return fileBuffer;
	}

	// Skip further processing of files that don't contain CRLF
	if (!fileBuffer.includes('\r\n')) {
		return fileBuffer;
	}

	if (convertEol) {
		// Convert CRLF->LF
		globalLogger.logInfo(
			`Converting line endings CRLF -> LF for file: ${filepath}`,
		);

		return convertEolInPlace(fileBuffer);
	} else {
		// Immediate warning
		globalLogger.logWarn(
			`CRLF (Windows) line endings detected in file: ${filepath}`,
		);
		// And summary warning later
		globalLogger.deferredLog(
			'Windows-format line endings were detected in some files, but were not converted due to `--noconvert-eol` option.',
			Logger.Level.WARN,
		);

		return fileBuffer;
	}
}

/**
 * Attempt to detect the encoding of a data buffer.
 * Code copied and modified from the npm package 'isbinaryfile' (MIT licence)
 *   https://github.com/gjtorikian/isBinaryFile/blob/master/src/index.ts
 *
 * @returns one of the possible values: '' (empty file), 'utf-8', 'utf-16',
 * 'utf-32', 'gb-18030', 'pdf', and 'binary'.
 *
 * Note: pure ASCII data is identified as 'utf-8' (ASCII is indeed a subset
 * of UTF-8).
 *
 * @param fileBuffer File contents whose encoding should be detected
 * @param bytesRead Optional "file size" if smaller than the buffer size
 */
export async function detectEncoding(
	fileBuffer: Buffer,
	bytesRead = fileBuffer.length,
): Promise<string> {
	// empty file
	if (bytesRead === 0) {
		return '';
	}

	const totalBytes = Math.min(bytesRead, DETECT_MAX_BYTES);

	// UTF-8 BOM
	if (
		bytesRead >= 3 &&
		fileBuffer[0] === 0xef &&
		fileBuffer[1] === 0xbb &&
		fileBuffer[2] === 0xbf
	) {
		return 'utf-8';
	}

	// UTF-32 BOM
	if (
		bytesRead >= 4 &&
		fileBuffer[0] === 0x00 &&
		fileBuffer[1] === 0x00 &&
		fileBuffer[2] === 0xfe &&
		fileBuffer[3] === 0xff
	) {
		return 'utf-32';
	}

	// UTF-32 LE BOM
	if (
		bytesRead >= 4 &&
		fileBuffer[0] === 0xff &&
		fileBuffer[1] === 0xfe &&
		fileBuffer[2] === 0x00 &&
		fileBuffer[3] === 0x00
	) {
		return 'utf-32';
	}

	// GB BOM (https://en.wikipedia.org/wiki/GB_18030)
	if (
		bytesRead >= 4 &&
		fileBuffer[0] === 0x84 &&
		fileBuffer[1] === 0x31 &&
		fileBuffer[2] === 0x95 &&
		fileBuffer[3] === 0x33
	) {
		return 'gb-18030';
	}

	if (totalBytes >= 5 && fileBuffer.slice(0, 5).toString() === '%PDF-') {
		/* PDF. This is binary. */
		return 'pdf';
	}

	// UTF-16 BE BOM
	if (bytesRead >= 2 && fileBuffer[0] === 0xfe && fileBuffer[1] === 0xff) {
		return 'utf-16';
	}

	// UTF-16 LE BOM
	if (bytesRead >= 2 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xfe) {
		return 'utf-16';
	}

	for (let i = 0; i < totalBytes; i++) {
		let c = fileBuffer[i];
		if (c === 0) {
			// NULL byte
			return 'binary';
		} else if (c === 27) {
			// ESC character used in ANSI escape sequences for text color (log files)
			continue;
		} else if ((c < 7 || c > 14) && (c < 32 || c > 127)) {
			// UTF-8 detection
			if (c > 193 && c < 224 && i + 1 < totalBytes) {
				i++;
				c = fileBuffer[i];
				if (c > 127 && c < 192) {
					continue;
				}
			} else if (c > 223 && c < 240 && i + 2 < totalBytes) {
				i++;
				c = fileBuffer[i];
				if (
					c > 127 &&
					c < 192 &&
					fileBuffer[i + 1] > 127 &&
					fileBuffer[i + 1] < 192
				) {
					i++;
					continue;
				}
			}
			return 'binary';
		}
	}

	return 'utf-8';
}
