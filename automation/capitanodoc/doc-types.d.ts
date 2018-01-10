import { CommandDefinition } from 'capitano';

export interface Document {
	title: string;
	introduction: string;
	categories: Category[];
}

export interface Category {
	title: string;
	commands: CommandDefinition[];
}

export { CommandDefinition as Command };
