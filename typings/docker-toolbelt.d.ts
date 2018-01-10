declare module 'docker-toolbelt' {
	import * as Promise from 'bluebird';
	import * as Dockerode from 'dockerode';

	class DockerToolbelt extends Dockerode {
		imageRootDir(image: string): Promise<string>;
		imageRootDirMounted(image: string): Promise<string>;
		diffPaths(image: string): Promise<string>;
		createEmptyImage(config: {}): Promise<string>;
		createDeltaSync(
			src: string,
			dest: string,
			onProgress?: (event: {}) => void,
		): Promise<string>;
		getRegistryAndName(
			imageUrl: string,
		): Promise<{
			imageName: string;
			registry?: string;
			tagName?: string;
			digest?: string;
		}>;
		compileRegistryAndName(options: {
			imageName: string;
			registry?: string;
			tagName?: string;
			digest?: string;
		}): Promise<string>;
		normaliseImageName(imageUrl: string): Promise<string>;
	}

	export = DockerToolbelt;
}
