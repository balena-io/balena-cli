declare module 'rindle' {
	export function extract(
		stream: NodeJS.ReadableStream,
		callback: (error: Error, data: string) => void
	): void;

	export function wait(
		stream: {
			on(event: string, callback: Function): void;
		},
		callback: (error: Error, data: string) => void
	): void;
}
