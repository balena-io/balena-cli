declare module 'pkg' {
	export function exec(args: string[]): Promise<void>;
}

declare module 'filehound' {
	export function create(): FileHound;

	export interface FileHound {
		paths(paths: string[]): FileHound;
		paths(...paths: string[]): FileHound;
		ext(extensions: string[]): FileHound;
		ext(...extensions: string[]): FileHound;
		find(): Promise<string[]>;
	}
}

declare module 'publish-release' {
	interface PublishOptions {
		token: string;
		owner: string;
		repo: string;
		tag: string;
		name: string;
		reuseRelease?: boolean;
		assets: string[];
	}

	interface Release {
		html_url: string;
	}

	let publishRelease: (
		args: PublishOptions,
		callback: (e: Error, release: Release) => void,
	) => void;

	export = publishRelease;
}
