declare module 'resin-cli-form' {
	import * as Promise from 'bluebird';

	/*
	 * This might look tricky, but it's not too bad. We're aiming to end up
	 * with types that allow you to pass an question literal object that specifies
	 * a question type ('input', 'confirm', 'list'), and maybe some options
	 * like a default or list of choices, and to get TypeScript to automatically
	 * infer the type of the answer we'll get (string, boolean, the inferred common
	 * type of the choices available).
	 *
	 * The generics are the tricky bit. For reference:
	 *
	 * K: the key of the question ('appName')
	 * T: the string literal type of the question ('input', 'list')
	 * V: the type of the return value for the question (string, boolean, number|null)
	 */

	type FormTypesMap = {
		input: string;
		password: string;
		confirm: boolean;
		list: any;
	};

	type FormTypes = keyof FormTypesMap;

	interface Question<V extends FormTypesMap[T], T extends FormTypes> {
		message: string;
		name?: string;
		type: T;
		when?: { [key: string]: any };
		default?: V;
		validate?: (arg: V) => boolean | string;
		choices?: Array<V | { name: string; value: V }>;
	}

	interface NamedQuestion<
		K extends string,
		V extends FormTypesMap[T],
		T extends FormTypes
	> extends Question<V, T> {
		name: K;
	}

	export function run<
		K extends string,
		V extends FormTypesMap[T],
		T extends FormTypes
	>(
		form: NamedQuestion<K, V, T>[],
		options?: { override?: Partial<{ [k in K]: V }> },
	): Promise<{ [k in K]: V }>;

	export function ask<V extends FormTypesMap[T], T extends FormTypes>(
		question: Question<V, T>,
	): Promise<V>;
}
