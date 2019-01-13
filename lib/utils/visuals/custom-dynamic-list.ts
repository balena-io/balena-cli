import DynamicList = require('inquirer-dynamic-list');

export abstract class CustomDynamicList<T> extends DynamicList {
	constructor(message: string, emptyMessage: string) {
		super({ message, emptyMessage, choices: [] });
	}

	protected abstract getThings(): Iterable<T>;

	protected abstract format(thing: T): string;

	refresh(): void {
		this.opt.choices.choices = [];
		this.opt.choices.realChoices = [];
		for (const thing of this.getThings()) {
			this.addChoice({ name: this.format(thing), value: thing });
		}
		this.render();
	}

	async run(): Promise<T> {
		this.refresh();
		return await super.run();
	}
}
