declare module 'inquirer-dynamic-list' {
	interface Choice {
		name: string;
		value: any;
	}

	class DynamicList {
		opt: {
			choices: {
				choices: Choice[];
				realChoices: Choice[];
			};
		};

		constructor(options: {
			message?: string;
			emptyMessage?: string;
			choices: Choice[];
		});
		addChoice(choice: Choice): void;
		render(): void;
		run(): Promise<any>;
	}

	export = DynamicList;
}
