declare module 'color-hash' {
	interface Hasher {
		hex(text: string): string;
	}

	class ColorHash {
		hex(text: string): string;
		rgb(text: string): [number, number, number];
	}

	export = ColorHash;
}
