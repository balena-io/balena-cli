/**
 * @license
 * Copyright 2019 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

	export function parse(pattern: any | any[]): NodeJS.ReadWriteStream;

	type NewlineOnlyIndicator = false;

	/**
	 * Create a writable stream.
	 * you may pass in custom open, close, and seperator strings. But, by default,
	 * JSONStream.stringify() will create an array,
	 * (with default options open='[\n', sep='\n,\n', close='\n]\n')
	 *
	 * If you call JSONStream.stringify(false) the elements will only be separated by a newline.
	 */
	export function stringify(
		newlineOnly?: NewlineOnlyIndicator,
	): NodeJS.ReadWriteStream;

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
