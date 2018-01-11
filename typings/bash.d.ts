declare module 'bash' {
	export function escape(param: string): string;
	export function args(options: object, prefix: string, suffix: string): string;
}
