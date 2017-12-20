declare module 'resin-image-fs' {
	import Promise = require('bluebird');

	export function read(options: {}): Promise<NodeJS.ReadableStream>;
}
