/**
 * @license
 * Copyright 2016-2019 Balena Ltd.
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

import * as chai from 'chai';
import { balenaAPIMock, runCommand } from '../../helpers';

describe('balena env rename', function() {
	it('should successfully rename an environment variable', async () => {
		const mock = balenaAPIMock();
		mock.patch(/device_environment_variable\(376\)/).reply(200, 'OK');

		const { out, err } = await runCommand('env rename 376 emacs --device');

		chai.expect(out.join('')).to.equal('');
		chai.expect(err.join('')).to.equal('');

		// @ts-ignore
		mock.remove();
	});
});
