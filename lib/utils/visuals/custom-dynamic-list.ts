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
import DynamicList = require('inquirer-dynamic-list');

export abstract class CustomDynamicList<T> extends DynamicList {
	constructor(message: string, emptyMessage: string) {
		super({ message, emptyMessage, choices: [] });
	}

	protected abstract getThings(): Iterable<T>;

	protected abstract format(thing: T): string;

	public refresh(): void {
		this.opt.choices.choices = [];
		this.opt.choices.realChoices = [];
		for (const thing of this.getThings()) {
			this.addChoice({ name: this.format(thing), value: thing });
		}
		this.render();
	}

	public async run(): Promise<T> {
		this.refresh();
		return await super.run();
	}
}
