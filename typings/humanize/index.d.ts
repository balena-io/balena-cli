declare module 'humanize' {
	export function filesize(
		filesize?: number,
		kilo?: number,
		decimals?: number,
		decPoint?: string,
		thousandsSep?: string,
		suffixSep?: string,
	): string;
}
