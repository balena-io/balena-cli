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

	if (!_.isEmpty(option.alias)) {
		if (_.isString(option.alias)) {
			result += `, ${getOptionSignature(option.alias)}`;
		} else {
			for (let alias of option.alias!) {
				result += `, ${getOptionSignature(alias)}`;
			}
		}
	}

	if (option.parameter != null) {
		result += ` <${option.parameter}>`;
	}

	return ent.encode(result);
}
