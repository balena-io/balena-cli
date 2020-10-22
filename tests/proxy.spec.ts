/**
 * @license
 * Copyright 2020 Balena Ltd.
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

import { expect } from 'chai';

import {
	GlobalTunnelNgConfig,
	makeUrlFromTunnelNgConfig,
} from '../build/utils/proxy';

describe('makeUrlFromTunnelNgConfig() function', function () {
	it('should return a URL given a GlobalTunnelNgConfig object', () => {
		const tunnelNgConfig: GlobalTunnelNgConfig = {
			host: 'proxy.company.com',
			port: 8080,
			proxyAuth: 'bob:secret',
			protocol: 'http:',
			connect: 'https',
		};
		const expectedUrl = 'http://bob:secret@proxy.company.com:8080';
		const url = makeUrlFromTunnelNgConfig(tunnelNgConfig);
		expect(url).to.deep.equal(expectedUrl);
	});
});
