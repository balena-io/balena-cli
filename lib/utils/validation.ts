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

	return true;
}
