/*
Copyright 2016-2017 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import validEmail = require('@resin.io/valid-email');

const APPNAME_REGEX = new RegExp(/^[a-zA-Z0-9_-]+$/);
// An regex to detect an IP address, from https://www.regular-expressions.info/ip.html
const IP_REGEX = new RegExp(
	/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/,
);
const DOTLOCAL_REGEX = new RegExp(/^([a-zA-Z0-9-]+\.)+local$/);
const UUID_REGEX = new RegExp(/^[0-9a-f]+$/);

export function validateEmail(input: string) {
	if (!validEmail(input)) {
		return 'Email is not valid';
	}

	return true;
}

export function validatePassword(input: string) {
	if (input.length < 8) {
		return 'Password should be 8 characters long';
	}

	return true;
}

export function validateApplicationName(input: string) {
	if (input.length < 4) {
		return 'The application name should be at least 4 characters';
	}

	return APPNAME_REGEX.test(input);
}

export function validateIPAddress(input: string): boolean {
	return IP_REGEX.test(input);
}

export function validateDotLocalUrl(input: string): boolean {
	return DOTLOCAL_REGEX.test(input);
}

export function validateLongUuid(input: string): boolean {
	if (input.length !== 32 && input.length !== 64) {
		return false;
	}
	return UUID_REGEX.test(input);
}

export function validateShortUuid(input: string): boolean {
	if (input.length !== 7) {
		return false;
	}
	return UUID_REGEX.test(input);
}

export function validateUuid(input: string): boolean {
	return validateLongUuid(input) || validateShortUuid(input);
}
