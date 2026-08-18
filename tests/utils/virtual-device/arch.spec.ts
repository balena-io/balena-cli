/**
 * @license
 * Copyright 2026 Balena Ltd.
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
import * as os from 'os';

describe('architecture detection', function () {
	describe('detectArchitecture()', function () {
		let detectArchitecture: typeof import('../../../build/utils/virtual-device/arch.js').detectArchitecture;

		beforeEach(async function () {
			const archModule = await import(
				'../../../build/utils/virtual-device/arch.js'
			);
			detectArchitecture = archModule.detectArchitecture;
		});

		it('should return a valid HostArchitecture', function () {
			const result = detectArchitecture();
			expect(result).to.be.oneOf(['x64', 'arm64']);
		});

		it('should return x64 on x64 machines', function () {
			// Test runs on real hardware - verify expected mapping for x64
			if (os.arch() === 'x64') {
				const result = detectArchitecture();
				expect(result).to.equal('x64');
			} else {
				this.skip(); // Skip if not on x64
			}
		});

		it('should return arm64 on arm64 machines', function () {
			// Test runs on real hardware - verify expected mapping for arm64
			if (os.arch() === 'arm64') {
				const result = detectArchitecture();
				expect(result).to.equal('arm64');
			} else {
				this.skip(); // Skip if not on arm64
			}
		});
	});
});
