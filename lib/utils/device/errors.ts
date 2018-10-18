import * as _ from 'lodash';
import { TypedError } from 'typed-error';

export interface BuildFailure {
	error: Error;
	serviceName: string;
}

export class BuildError extends TypedError {
	private failures: BuildFailure[];

	public constructor(failures: BuildFailure[]) {
		super('Build error');

		this.failures = failures;
	}

	public toString(): string {
		let str = 'Some services failed to build:\n';
		_.each(this.failures, failure => {
			str += `\t${failure.serviceName}: ${failure.error.message}\n`;
		});
		return str;
	}
}

export class DeviceAPIError extends TypedError {}

export class BadRequestDeviceAPIError extends DeviceAPIError {}
export class ServiceUnavailableAPIError extends DeviceAPIError {}
