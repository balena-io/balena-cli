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

import * as path from 'path';
import { MarkdownFileParser } from './utils';
import { globSync } from 'glob';

/**
 * This is the skeleton of CLI documentation/reference web page at:
 * https://www.balena.io/docs/reference/cli/
 *
 * The `getCapitanoDoc` function in this module parses README.md and adds
 * some content to this object.
 *
 * IMPORTANT
 *
 * All commands need to be stored under a folder in lib/commands to maintain uniformity
 * Generating docs will error out if directive not followed
 * To add a custom heading for command docs, add the heading next to the folder name
 * in the `commandHeadings` dictionary.
 *
 * This dictionary is the source of truth that creates the docs config which is used
 * to generate the CLI documentation. By default, the folder name will be used.
 *
 * Resources with plural names needs to have 2 sections if they have commands like:
 * "fleet, fleets" or "device, devices" or "tag, tags"
 *
 */

interface Category {
	title: string;
	files: string[];
}

interface Documentation {
	title: string;
	introduction: string;
	categories: Category[];
}

// Mapping folders names to custom headings in the docs
const commandHeadings: { [key: string]: string } = {
	'api-key': 'API Key',
	'api-keys': 'API Keys',
	auth: 'Authentication',
	env: 'Environment Variable',
	envs: 'Environment Variables',
	help: 'Help and Version',
	key: 'SSH Key',
	keys: 'SSH Keys',
	orgs: 'Organizations',
	os: 'OS',
	util: 'Utilities',
};

// Fetch all available commands
const allCommandsPaths = globSync('build/commands/**/*.js', {
	ignore: 'build/commands/internal/**',
});

// Docs config template
let capitanoDoc: Documentation = {
	title: 'balena CLI Documentation',
	introduction: '',
	categories: [],
};

// Helper function to capitalize each word of directory name
function formatTitle(dir: string): string {
	return dir.replace(/(^\w|\s\w)/g, (word) => word.toUpperCase());
}

// Create a map to track the categories for faster lookup
const categoriesMap: { [key: string]: Category } = {};

for (const commandPath of allCommandsPaths) {
	const commandDir = path.basename(path.dirname(commandPath));
	const heading = commandHeadings[commandDir] || formatTitle(commandDir);

	if (!categoriesMap[heading]) {
		categoriesMap[heading] = { title: heading, files: [] };
		capitanoDoc.categories.push(categoriesMap[heading]);
	}

	categoriesMap[heading].files.push(commandPath);
}

// Sort Category titles alhpabetically
capitanoDoc.categories = capitanoDoc.categories.sort((a, b) =>
a.title.localeCompare(b.title),
);

// Sort Category file paths alhpabetically
capitanoDoc.categories.forEach((category) => {
	category.files.sort((a, b) => a.localeCompare(b));
});

// TODO: Generate an error if commands are not in their folder

/**
 * Modify and return the `capitanoDoc` object above in order to generate the
 * CLI documentation at docs/balena-cli.md
 *
 * This function parses the README.md file to extract relevant sections
 * for the documentation web page.
 */
export async function getCapitanoDoc(): Promise<typeof capitanoDoc> {
	const readmePath = path.join(__dirname, '..', '..', 'README.md');
	const mdParser = new MarkdownFileParser(readmePath);
	const sections: string[] = await Promise.all([
		mdParser.getSectionOfTitle('About').then((sectionLines: string) => {
			// delete the title of the 'About' section for the web page
			const match = /^(#+)\s+.+?\n\s*([^]*)/.exec(sectionLines);
			if (!match || match.length < 3) {
				throw new Error(`Error parsing section title`);
			}
			// match[1] has the title, match[2] has the rest
			return match && match[2];
		}),
		mdParser.getSectionOfTitle('Installation'),
		mdParser.getSectionOfTitle('Choosing a shell (command prompt/terminal)'),
		mdParser.getSectionOfTitle('Logging in'),
		mdParser.getSectionOfTitle('Proxy support'),
		mdParser.getSectionOfTitle('Support, FAQ and troubleshooting'),
		mdParser.getSectionOfTitle('Deprecation policy'),
	]);
	capitanoDoc.introduction = sections.join('\n');
	return capitanoDoc;
}
