declare module 'resin-cli-visuals' {
	export class Spinner {
		constructor(message: string);

		start(): void;
		stop(): void;
	}

	export class Progress {
		constructor(message: string);
		update(state: { percentage: number; eta?: number }): void;
	}

	export namespace table {
		// Array<string>, not Array<keyof T>, because you're allowed
		// headings inline, like $My Heading$
		export function vertical<T>(item: T, properties: Array<string>): string;
		export function horizontal<T>(
			list: T[],
			properties: Array<keyof T>,
		): string;
	}
}
