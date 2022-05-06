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

declare module 'balena-sync' {
	import { CommandDefinition } from 'capitano';

	export function capitano(tool: 'balena-cli'): CommandDefinition;

	export interface LocalBalenaOsDevice {
		address: string;
		host: string;
		osVariant: string;
		port: number;
	}

	declare namespace forms {
		export function selectLocalBalenaOsDevice(
			timeout?: number,
		): Promise<string>;
	}

	declare namespace discover {
		export function discoverLocalBalenaOsDevices(
			timeout?: number,
		): Promise<LocalBalenaOsDevice[]>;
	}
}
