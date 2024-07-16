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

import * as fs from 'fs';
import * as readline from 'readline';

export function getOptionPrefix(signature: string) {
	if (signature.length > 1) {
		return '--';
	} else {
		return '-';
	}
}

export function getOptionSignature(signature: string) {
	return `${getOptionPrefix(signature)}${signature}`;
}

export class MarkdownFileParser {
	constructor(public mdFilePath: string) {}

	/**
	 * Extract the lines of a markdown document section with the given title.
	 * For example, consider this sample markdown document:
	 * ```
	 *     # balena CLI
	 *
	 *     ## Introduction
	 *     Lorem ipsum dolor sit amet, consectetur adipiscing elit,
	 *
	 *     ## Getting Started
	 *     sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
	 *
	 *     ### Prerequisites
	 *     - Foo
	 *     - Bar
	 *
	 *     ## Support
	 *     Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
	 * ```
	 *
	 * Calling getSectionOfTitle('Getting Started') for the markdown doc above
	 * returns everything from line '## Getting Started' (included) to line
	 * '## Support' (excluded). This method counts the number of '#' characters
	 * to determine that subsections should be included as part of the parent
	 * section.
	 *
	 * @param title The section title without '#' chars, eg. 'Getting Started'
	 */
	public async getSectionOfTitle(
		title: string,
		includeSubsections = true,
	): Promise<string> {
		let foundSectionLines: string[];
		let foundSectionLevel = 0;

		const rl = readline.createInterface({
			input: fs.createReadStream(this.mdFilePath),
			crlfDelay: Infinity,
		});

		rl.on('line', (line) => {
			// try to match a line like "## Getting Started", where the number
			// of '#' characters is the sectionLevel ('##' -> 2), and the
			// sectionTitle is "Getting Started"
			const match = /^(#+)\s+(.+)/.exec(line);
			if (match) {
				const sectionLevel = match[1].length;
				const sectionTitle = match[2];

				// If the target section had already been found: append a line, or end it
				if (foundSectionLines) {
					if (!includeSubsections || sectionLevel <= foundSectionLevel) {
						// end previously found section
						rl.close();
					}
				} else if (sectionTitle === title) {
					// found the target section
					foundSectionLevel = sectionLevel;
					foundSectionLines = [];
				}
			}
			if (foundSectionLines) {
				foundSectionLines.push(line);
			}
		});

		return await new Promise((resolve, reject) => {
			rl.on('close', () => {
				if (foundSectionLines) {
					resolve(foundSectionLines.join('\n'));
				} else {
					reject(
						new Error(
							`Markdown section not found: title="${title}" file="${this.mdFilePath}"`,
						),
					);
				}
			});
		});
	}
}
