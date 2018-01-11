declare module 'hasbin' {
	interface HasBin {
		(binaryName: string, callback: (result: boolean) => void): void;
		sync(binaryName: string): boolean;
	}
	const hasbin: HasBin;

	export = hasbin;
}
