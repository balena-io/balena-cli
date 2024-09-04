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

import { expect } from 'chai';

describe('@balena/compose/multibuild consistency', function () {
	it('should use the same values for selected constants', async () => {
		const { QEMU_BIN_NAME: MQEMU_BIN_NAME } = await import(
			'@balena/compose/dist/multibuild'
		);
		const { QEMU_BIN_NAME } = await import('../../build/utils/qemu.js');
		expect(QEMU_BIN_NAME).to.equal(MQEMU_BIN_NAME);
	});
});
