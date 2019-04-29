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
import * as ent from 'ent';
import * as _ from 'lodash';

import { Category, Command, Document } from './doc-types';
import * as utils from './utils';

export function renderCommand(command: Command) {
	let result = `## ${ent.encode(command.signature)}\n\n${command.help}\n`;

	if (!_.isEmpty(command.options)) {
		result += '\n### Options';

		for (const option of command.options!) {
			result += `\n\n#### ${utils.parseSignature(option)}\n\n${
				option.description
			}`;
		}

		result += '\n';
	}

	return result;
}

export function renderCategory(category: Category) {
	let result = `# ${category.title}\n`;

	for (const command of category.commands) {
		result += `\n${renderCommand(command)}`;
	}

	return result;
}

function getAnchor(command: Command) {
	return (
		'#' +
		command.signature
			.replace(/\s/g, '-')
			.replace(/</g, '-')
			.replace(/>/g, '-')
			.replace(/\[/g, '-')
			.replace(/\]/g, '-')
			.replace(/-+/g, '-')
			.replace(/-$/, '')
			.replace(/\.\.\./g, '')
			.replace(/\|/g, '')
			.toLowerCase()
	);
}

export function renderToc(categories: Category[]) {
	let result = `# CLI Command Reference\n`;

	for (const category of categories) {
		result += `\n- ${category.title}\n\n`;

		for (const command of category.commands) {
			result += `\t- [${ent.encode(command.signature)}](${getAnchor(
				command,
			)})\n`;
		}
	}

	return result;
}

export function render(doc: Document) {
	let result = `# ${doc.title}\n\n${doc.introduction}\n\n${renderToc(
		doc.categories,
	)}`;

	for (const category of doc.categories) {
		result += `\n${renderCategory(category)}`;
	}

	return result;
}
