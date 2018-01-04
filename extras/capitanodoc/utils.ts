import { OptionDefinition } from 'capitano';
import * as _ from 'lodash';
import * as ent from 'ent';

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
		for (let alias of option.alias) {
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
