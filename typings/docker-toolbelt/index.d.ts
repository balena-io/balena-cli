declare module 'docker-toolbelt' {
	import * as Docker from 'dockerode';

	interface ImageSpec {
		registry?: string;
		imageName: string;
		tagName: string;
		digest?: string;
	}

	type ProgressCallback = (event: any) => void;

	class DockerToolbelt extends Docker {
		public getRegistryAndName(image: string): Promise<ImageSpec>;
		public createDeltaAsync(
			src: string,
			dest: string,
			onProgress?: ProgressCallback,
		): Promise<string>;
	}

	export = DockerToolbelt;
}
