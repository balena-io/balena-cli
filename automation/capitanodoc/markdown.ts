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
import { Parser } from '@oclif/core';
import * as ent from 'ent';
import * as _ from 'lodash';

import { capitanoizeOclifUsage } from '../../src/utils/oclif-utils';
import type { Category, Document } from './doc-types';

function renderOclifCommand(command: Category['commands'][0]): string[] {
	const result = [`## ${ent.encode(command.name || '')}`];
	if (command.aliases?.length) {
		result.push('### Aliases');
		result.push(command.aliases.map((alias) => `- \`${alias}\``).join('\n'));
		result.push(
			`\nTo use one of the aliases, replace \`${command.name}\` with the alias.`,
		);
	}

	result.push('### Description');
	const description = (command.description || '')
		.split('\n')
		.slice(1) // remove the first line, which oclif uses as help header
		.join('\n')
		.trim();
	result.push(description);

	if (!_.isEmpty(command.examples)) {
		result.push('Examples:', command.examples!.map((v) => `\t${v}`).join('\n'));
	}

	if (!_.isEmpty(command.args)) {
		result.push('### Arguments');
		for (const [name, arg] of Object.entries(command.args!)) {
			result.push(`#### ${name.toUpperCase()}`, arg.description || '');
		}
	}

	if (!_.isEmpty(command.flags)) {
		result.push('### Options');
		for (const [name, flag] of Object.entries(command.flags!)) {
			if (name === 'help') {
				continue;
			}
			flag.name = name;
			const flagUsage = Parser.flagUsages([flag])
				.map(([usage, _description]) => usage)
				.join()
				.trim();
			result.push(`#### ${flagUsage}`);
			result.push(flag.description || '');
		}
	}
	return result;
}

function renderCategory(category: Category): string[] {
	const result = [`# ${category.title}`];
	for (const command of category.commands) {
		result.push(...renderOclifCommand(command));
	}
	return result;
}

function getAnchor(cmdSignature: string): string {
	return `#${_.trim(cmdSignature.replace(/\W+/g, '-'), '-').toLowerCase()}`;
}

function renderToc(categories: Category[]): string[] {
	const result = [`# CLI Command Reference`];

	for (const category of categories) {
		result.push(`- ${category.title}`);
		result.push(
			category.commands
				.map((command) => {
					const signature = capitanoizeOclifUsage(command.name);
					return `\t- [${ent.encode(signature)}](${getAnchor(signature)})`;
				})
				.join('\n'),
		);
	}
	return result;
}

export function render(doc: Document) {
	const result = [
		`# ${doc.title}`,
		doc.introduction,
		...renderToc(doc.categories),
	];
	for (const category of doc.categories) {
		result.push(...renderCategory(category));
	}
	return result.join('\n\n');
}
