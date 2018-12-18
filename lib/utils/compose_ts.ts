/**
 * @license
 * Copyright 2018 Balena Ltd.
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

import { RegistrySecrets } from 'resin-multibuild';
import { Pack } from 'tar-stream';

/**
 * Return a callback function that takes a tar-stream Pack object as argument
 * and uses it to add the '.balena/registry-secrets.json' metadata file that
 * contains usernames and passwords for private docker registries. The builder
 * will remove the file from the tar stream and use the secrets to pull base
 * images from users' private registries.
 * @param registrySecrets JS object containing registry usernames and passwords
 * @returns A callback function, or undefined if registrySecrets is empty
 */
export function getTarStreamCallbackForRegistrySecrets(
	registrySecrets: RegistrySecrets,
): ((pack: Pack) => void) | undefined {
	if (Object.keys(registrySecrets).length > 0) {
		return (pack: Pack) => {
			pack.entry(
				{ name: '.balena/registry-secrets.json' },
				JSON.stringify(registrySecrets),
			);
		};
	}
}
