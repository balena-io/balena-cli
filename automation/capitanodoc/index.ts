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
import { Category, Document } from './doc-types';
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

		for (const file of commandCategory.files) {
			// tslint:disable-next-line:no-var-requires
			const actions: any = require(path.join(process.cwd(), file));

			if (actions.signature) {
				category.commands.push(_.omit(actions, 'action'));
			} else {
				for (const actionName of Object.keys(actions)) {
					const actionCommand = actions[actionName];
					category.commands.push(_.omit(actionCommand, 'action'));
				}
			}
		}

		result.categories.push(category);
	}

	return markdown.render(result);
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
