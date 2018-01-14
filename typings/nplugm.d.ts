declare module 'nplugm' {
	import Promise = require('bluebird');
	export function list(regexp: RegExp): Promise<Array<string>>;
}
