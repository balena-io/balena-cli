/*
Copyright 2016-2018 Balena

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

import { BalenaSDK } from 'balena-sdk';
import _ = require('lodash');

export function normalizeUuidProp(
	params: { [key: string]: any },
	propName = 'uuid',
) {
	if (_.isNumber(params[propName])) {
		params[propName] =
			params[propName + '_raw'] || _.toString(params[propName]);
	}
}

export async function disambiguateReleaseParam(
	balena: BalenaSDK,
	param: string | number,
	paramRaw: string | undefined,
) {
	// the user has passed an argument that was parsed as a string
	if (!_.isNumber(param)) {
		return param;
	}

	// check whether the argument was indeed an ID
	return balena.models.release
		.get(param, { $select: 'id' })
		.catch(error => {
			// we couldn't find a release by id,
			// try whether it was a commit with all numeric digits
			return balena.models.release
				.get(paramRaw || _.toString(param), { $select: 'id' })
				.catchThrow(error);
		})
		.then(({ id }) => id);
};
