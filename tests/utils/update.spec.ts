/**
 * @license
 * Copyright 2022 Balena Ltd.
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
import stripIndent from 'common-tags/lib/stripIndent';

import { getNotifierMessage } from '../../build/utils/update';

import type { UpdateInfo } from 'update-notifier';

describe('getNotifierMessage() unit test', function () {
	const template: UpdateInfo = {
		current: '',
		latest: '',
		type: 'latest',
		name: '',
	};

	it('should return a simple update message including installation instructions', () => {
		const mockUpdateInfo = {
			...template,
			current: '12.1.1',
			latest: '12.3.0',
		};
		const msg = getNotifierMessage(mockUpdateInfo);
		expect(msg).to.equal(stripIndent`
			Update available 12.1.1 → 12.3.0
			https://github.com/balena-io/balena-cli/blob/master/INSTALL.md`);
	});

	it('should include a release notes link when a new major version is available', () => {
		const mockUpdateInfo = {
			...template,
			current: '12.1.1',
			latest: '13.3.0',
		};
		const msg = getNotifierMessage(mockUpdateInfo);
		expect(msg).to.equal(stripIndent`
			Update available 12.1.1 → 13.3.0
			https://github.com/balena-io/balena-cli/blob/master/INSTALL.md

			Check the v13 release notes at:
			https://github.com/balena-io/balena-cli/wiki/CLI-v13-Release-Notes`);
	});

	it('should return an empty string if no updates are available', () => {
		const mockUpdateInfo = {
			...template,
			current: '12.1.1',
			latest: '12.1.1',
		};
		const msg = getNotifierMessage(mockUpdateInfo);
		expect(msg).to.equal('');
	});

	it('should return an empty string if no updates are available', () => {
		const mockUpdateInfo = {
			...template,
			current: '14.1.1',
			latest: '12.1.1',
		};
		const msg = getNotifierMessage(mockUpdateInfo);
		expect(msg).to.equal('');
	});
});
