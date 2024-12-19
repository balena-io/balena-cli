/**
 * @license
 * Copyright 2018-2020 Balena Ltd.
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
import _ from 'lodash';

import { ExpectedError } from '../../errors.js';

export interface BuildFailure {
	error: Error;
	serviceName: string;
}

export class BuildError extends ExpectedError {
	private failures: BuildFailure[];

	public constructor(failures: BuildFailure[]) {
		super('Build error');

		this.failures = failures;
	}

	public toString(): string {
		let str = 'Some services failed to build:\n';
		_.each(this.failures, (failure) => {
			str += `\t${failure.serviceName}: ${failure.error.message}\n`;
		});
		return str;
	}

	public getServiceError(serviceName: string): string {
		const failure = _.find(this.failures, (f) => f.serviceName === serviceName);
		if (failure == null) {
			return 'Unknown build failure';
		}

		return failure.error.message;
	}
}

export class DeviceAPIError extends ExpectedError {}

export class BadRequestDeviceAPIError extends DeviceAPIError {}
export class ServiceUnavailableAPIError extends DeviceAPIError {}
