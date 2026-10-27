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

import { getProxyConfig } from '../../build/utils/helpers';

describe('getProxyConfig() function', function () {
	let originalProxyConfig: [boolean, object | undefined];
	let originalHttpProxy: [boolean, string | undefined];
	let originalHttpsProxy: [boolean, string | undefined];

	beforeEach(() => {
		originalProxyConfig = [
			Object.hasOwn(global, 'PROXY_CONFIG'),
			(global as any).PROXY_CONFIG,
		];
		originalHttpProxy = [
			Object.hasOwn(process.env, 'HTTP_PROXY'),
			process.env.HTTP_PROXY,
		];
		originalHttpsProxy = [
			Object.hasOwn(process.env, 'HTTPS_PROXY'),
			process.env.HTTPS_PROXY,
		];
		delete (global as any).PROXY_CONFIG;
		delete process.env.HTTP_PROXY;
		delete process.env.HTTPS_PROXY;
	});

	afterEach(() => {
		if (originalProxyConfig[0]) {
			(global as any).PROXY_CONFIG = originalProxyConfig[1];
		}
		if (originalHttpProxy[0]) {
			process.env.HTTP_PROXY = originalHttpProxy[1];
		}
		if (originalHttpsProxy[0]) {
			process.env.HTTPS_PROXY = originalHttpsProxy[1];
		}
	});

	it('should return a ProxyConfig object when global-tunnel-ng is in use', () => {
		(global as any).PROXY_CONFIG = {
			host: '127.0.0.1',
			port: 8080,
			proxyAuth: 'bob:secret',
			protocol: 'http:',
			connect: 'https',
		};
		const expectedProxyConfig = {
			host: '127.0.0.1',
			port: '8080',
			proxyAuth: 'bob:secret',
			username: 'bob',
			password: 'secret',
		};
		expect(getProxyConfig()).to.deep.equal(expectedProxyConfig);
	});

	it('should return a ProxyConfig object when the HTTP(S)_PROXY env vars are defined', () => {
		process.env.HTTPS_PROXY = 'http://bob:secret@proxy.company.com:12345';
		process.env.HTTP_PROXY = 'http://my.net:8080';
		const expectedProxyConfig = {
			host: 'proxy.company.com',
			port: '12345',
			proxyAuth: 'bob:secret',
			username: 'bob',
			password: 'secret',
		};
		expect(getProxyConfig()).to.deep.equal(expectedProxyConfig);
	});
});
