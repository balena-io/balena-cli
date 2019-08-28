declare module 'hidepath' {
	type HidepathFn = (path: string) => string;

	const hidepath: HidepathFn;

	export = hidepath;
}
