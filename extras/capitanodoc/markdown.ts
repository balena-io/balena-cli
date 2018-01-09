import * as _ from 'lodash';
import * as ent from 'ent';
import * as utils from './utils';
import { Document, Category, Command } from './doc-types';

export function renderCommand(command: Command) {
	let result = `## ${ent.encode(command.signature)}\n\n${command.help}\n`;

	if (!_.isEmpty(command.options)) {
		result += '\n### Options';

		for (let option of command.options!) {
			result += `\n\n#### ${utils.parseSignature(option)}\n\n${option.description}`;
		}

		result += '\n';
	}

	return result;
}

export function renderCategory(category: Category) {
	let result = `# ${category.title}\n`;

	for (let command of category.commands) {
		result += `\n${renderCommand(command)}`;
	}

	return result;
}

function getAnchor(command: Command) {
	return '#' + command.signature
		.replace(/\s/g,'-')
		.replace(/</g, '60-')
		.replace(/>/g, '-62-')
		.replace(/\[/g, '')
		.replace(/\]/g, '-')
		.replace(/--/g, '-')
		.replace(/\.\.\./g, '')
		.replace(/\|/g, '')
		.toLowerCase();
}

export function renderToc(categories: Category[]) {
	let result = `# Table of contents\n`;

	for (let category of categories) {

		result += `\n- ${category.title}\n\n`;

		for (let command of category.commands) {
			result += `\t- [${ent.encode(command.signature)}](${getAnchor(command)})\n`;
		}
	}

	return result;
}

export function render(doc: Document) {
	let result = `# ${doc.title}\n\n${doc.introduction}\n\n${renderToc(doc.categories)}`;

	for (let category of doc.categories) {
		result += `\n${renderCategory(category)}`;
	}

	return result;
}
