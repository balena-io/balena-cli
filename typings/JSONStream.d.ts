// These are the DefinitelyTyped typings for JSONStream, but because of this
// mismatch in case of jsonstream and JSONStream, it is necessary to include
// them this way, with an upper case module declaration. They have also
// been slightly edited to remove the extra `declare` keyworks (which are
// not necessary or accepted inside a `declare module '...' {` block)
declare module 'JSONStream' {
	// Type definitions for JSONStream v0.8.0
	// Project: https://github.com/dominictarr/JSONStream
	// Definitions by: Bart van der Schoor <https://github.com/Bartvds>
	// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

	/// <reference types="node" />

	export interface Options {
		recurse: boolean;
	}

	export function parse(pattern: any): NodeJS.ReadWriteStream;
	export function parse(patterns: any[]): NodeJS.ReadWriteStream;

	/**
	 * Create a writable stream.
	 * you may pass in custom open, close, and seperator strings. But, by default,
	 * JSONStream.stringify() will create an array,
	 * (with default options open='[\n', sep='\n,\n', close='\n]\n')
	 */
	export function stringify(): NodeJS.ReadWriteStream;

	/** If you call JSONStream.stringify(false) the elements will only be seperated by a newline. */
	export function stringify(
		newlineOnly: NewlineOnlyIndicator,
	): NodeJS.ReadWriteStream;
	type NewlineOnlyIndicator = false;

	/**
	 * Create a writable stream.
	 * you may pass in custom open, close, and seperator strings. But, by default,
	 * JSONStream.stringify() will create an array,
	 * (with default options open='[\n', sep='\n,\n', close='\n]\n')
	 */
	export function stringify(
		open: string,
		sep: string,
		close: string,
	): NodeJS.ReadWriteStream;

	export function stringifyObject(): NodeJS.ReadWriteStream;
	export function stringifyObject(
		open: string,
		sep: string,
		close: string,
	): NodeJS.ReadWriteStream;
}
