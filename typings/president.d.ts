declare module 'president' {
	export function execute(
		command: string[],
		callback: (err: Error) => void,
	): void;
}
