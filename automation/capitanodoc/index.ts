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
import * as _ from 'lodash';
import * as path from 'path';

import { getCapitanoDoc } from './capitanodoc';
import { CapitanoCommand, Category, Document, OclifCommand } from './doc-types';
import * as markdown from './markdown';

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
			category.commands.push(
				...(jsFilename.includes('actions-oclif')
					? importOclifCommands(jsFilename)
					: importCapitanoCommands(jsFilename)),
			);
		}
		result.categories.push(category);
	}

	return markdown.render(result);
}

function importCapitanoCommands(jsFilename: string): CapitanoCommand[] {
	const actions = require(path.join(process.cwd(), jsFilename));
	const commands: CapitanoCommand[] = [];

	if (actions.signature) {
		commands.push(_.omit(actions, 'action'));
	} else {
		for (const actionName of Object.keys(actions)) {
			const actionCommand = actions[actionName];
			commands.push(_.omit(actionCommand, 'action'));
		}
	}
	return commands;
}

function importOclifCommands(jsFilename: string): OclifCommand[] {
	const command: OclifCommand = require(path.join(process.cwd(), jsFilename))
		.default as OclifCommand;
	return [command];
}

/**
 * Print the CLI docs markdown to stdout.
 * See package.json for how the output is redirected to a file.
 */
function printMarkdown() {
	renderMarkdown()
		.then((mdDocs: string) => {
			console.log(mdDocs);
		})
		.catch((error: Error) => {
			console.error(error);
			process.exit(1);
		});
}

printMarkdown();
