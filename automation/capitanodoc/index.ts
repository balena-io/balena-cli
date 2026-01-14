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
import { getCapitanoDoc } from './capitanodoc.js';
import type { Category, Document, OclifCommand } from './doc-types';
import * as markdown from './markdown.js';

/**
 * Generates the markdown document (as a string) for the CLI documentation
 * page on the web: https://www.balena.io/docs/reference/cli/
 */
export async function renderMarkdown(): Promise<string> {
	const capitanodoc = await getCapitanoDoc();
	const result: Document = {
		title: capitanodoc.title,
		introduction: capitanodoc.introduction,
		categories: [],
	};

	for (const commandCategory of capitanodoc.categories) {
		const category: Category = {
			title: commandCategory.title,
			commands: [],
		};

		for (const jsFilename of commandCategory.files) {
			category.commands.push(await importOclifCommands(jsFilename));
		}
		result.categories.push(category);
	}

	return markdown.render(result);
}

async function importOclifCommands(jsFilename: string) {
	const command = (await import(path.join(process.cwd(), jsFilename)))
		.default as OclifCommand;

	return {
		...command,
		// build/commands/device/index.js -> device
		// build/commands/device/list.js -> device list
		name: jsFilename
			.split('/')
			.slice(2)
			.join(' ')
			.split('.')
			.slice(0, 1)
			.join(' ')
			.split(' index')[0],
	} as Category['commands'][0];
}

/**
 * Print the CLI docs markdown to stdout.
 * See package.json for how the output is redirected to a file.
 */
async function printMarkdown() {
	try {
		console.log(await renderMarkdown());
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
printMarkdown();
