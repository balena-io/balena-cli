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
import ent from 'ent';
import _ from 'lodash';

import { getManualSortCompareFunction } from '../../lib/utils/helpers';
import { capitanoizeOclifUsage } from '../../lib/utils/oclif-utils';
import type { Category, Document, OclifCommand } from './doc-types';

function renderOclifCommand(command: OclifCommand): string[] {
	const result = [`## ${ent.encode(command.usage || '')}`];
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
					const signature = capitanoizeOclifUsage(command.usage);
					return `\t- [${ent.encode(signature)}](${getAnchor(signature)})`;
				})
				.join('\n'),
		);
	}
	return result;
}

const manualCategorySorting: { [category: string]: string[] } = {
	'Environment Variables': ['envs', 'env rm', 'env add', 'env rename'],
	OS: [
		'os versions',
		'os download',
		'os build config',
		'os configure',
		'os initialize',
	],
};

function sortCommands(doc: Document): void {
	for (const category of doc.categories) {
		if (category.title in manualCategorySorting) {
			category.commands = category.commands.sort(
				getManualSortCompareFunction<OclifCommand, string>(
					manualCategorySorting[category.title],
					(cmd: OclifCommand, x: string) =>
						(cmd.usage || '').toString().replace(/\W+/g, ' ').includes(x),
				),
			);
		}
	}
}

export function render(doc: Document) {
	sortCommands(doc);
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
