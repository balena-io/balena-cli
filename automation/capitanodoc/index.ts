import capitanodoc = require('../../capitanodoc');
import * as _ from 'lodash';
import * as path from 'path';
import * as markdown from './markdown';
import { Document, Category } from './doc-types';

const result = <Document>{};
result.title = capitanodoc.title;
result.introduction = capitanodoc.introduction;
result.categories = [];

for (let commandCategory of capitanodoc.categories) {
	const category = <Category>{};
	category.title = commandCategory.title;
	category.commands = [];

	for (let file of commandCategory.files) {
		// tslint:disable-next-line:no-var-requires
		const actions: any = require(path.join(process.cwd(), file));

		if (actions.signature) {
			category.commands.push(_.omit(actions, 'action'));
		} else {
			for (let actionName of Object.keys(actions)) {
				const actionCommand = actions[actionName];
				category.commands.push(_.omit(actionCommand, 'action'));
			}
		}
	}

	result.categories.push(category);
}

console.log(markdown.render(result));
