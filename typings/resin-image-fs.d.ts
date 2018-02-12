declare module 'resin-image-fs' {
	import Promise = require('bluebird');

	export function readFile(options: {}): Promise<string>;
}
