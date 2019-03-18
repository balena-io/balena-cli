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
import { OptionDefinition } from 'capitano';
import * as ent from 'ent';
import * as _ from 'lodash';

export function getOptionPrefix(signature: string) {
	if (signature.length > 1) {
		return '--';
	} else {
		return '-';
	}
}

export function getOptionSignature(signature: string) {
	return `${getOptionPrefix(signature)}${signature}`;
}

export function parseSignature(option: OptionDefinition) {
	let result = getOptionSignature(option.signature);

	if (_.isArray(option.alias)) {
		for (const alias of option.alias) {
			result += `, ${getOptionSignature(alias)}`;
		}
	} else if (_.isString(option.alias)) {
		result += `, ${getOptionSignature(option.alias)}`;
	}

	if (option.parameter) {
		result += ` <${option.parameter}>`;
	}

	return ent.encode(result);
}
