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
import _ from 'lodash';
import request from 'request';
import type * as Stream from 'stream';

import { retry } from '../helpers.js';
import type Logger from '../logger.js';
import * as ApiErrors from './errors.js';

export interface DeviceResponse {
	[key: string]: any;

	status: 'success' | 'failed';
	message?: string;
}

export interface DeviceInfo {
	deviceType: string;
	arch: string;
}

export interface Status {
	appState: 'applied' | 'applying';
	overallDownloadProgress: null | number;
	containers: Array<{
		status: string;
		serviceName: string;
		appId: number;
		imageId: number;
		serviceId: number;
		containerId: string;
		createdAt: string;
	}>;
	images: Array<{
		name: string;
		appId: number;
		serviceName: string;
		imageId: number;
		dockerImageId: string;
		status: string;
		downloadProgress: null | number;
	}>;
}

const deviceEndpoints = {
	setTargetState: 'v2/local/target-state',
	getTargetState: 'v2/local/target-state',
	getDeviceInformation: 'v2/local/device-info',
	logs: 'v2/local/logs',
	ping: 'ping',
	version: 'v2/version',
	status: 'v2/state/status',
	containerId: 'v2/containerId',
};

export class DeviceAPI {
	private deviceAddress: string;

	public constructor(
		private logger: Logger,
		addr: string,
		port: number = 48484,
	) {
		this.deviceAddress = `http://${addr}:${port}/`;
	}

	// Either return nothing, or throw an error with the info
	public async setTargetState(state: any): Promise<void> {
		const url = this.getUrlForAction('setTargetState');
		return DeviceAPI.promisifiedRequest(
			{
				method: 'POST',
				url,
				json: true,
				body: state,
			},
			this.logger,
		);
	}

	public async getTargetState(): Promise<any> {
		const url = this.getUrlForAction('getTargetState');

		return DeviceAPI.promisifiedRequest(
			{
				method: 'GET',
				url,
				json: true,
			},
			this.logger,
		).then((body) => {
			return body.state;
		});
	}

	public async getDeviceInformation(): Promise<DeviceInfo> {
		const url = this.getUrlForAction('getDeviceInformation');

		return DeviceAPI.promisifiedRequest(
			{
				method: 'GET',
				url,
				json: true,
			},
			this.logger,
		).then((body) => {
			return body.info;
		});
	}

	public async getContainerId(serviceName: string): Promise<string> {
		const url = this.getUrlForAction('containerId');

		const body = await DeviceAPI.promisifiedRequest(
			{
				method: 'GET',
				url,
				json: true,
				qs: {
					serviceName,
				},
			},
			this.logger,
		);

		if (body.status !== 'success') {
			throw new ApiErrors.DeviceAPIError(
				'Non-successful response from supervisor containerId endpoint',
			);
		}
		return body.containerId;
	}

	public async ping(): Promise<void> {
		const url = this.getUrlForAction('ping');

		return DeviceAPI.promisifiedRequest(
			{
				method: 'GET',
				url,
			},
			this.logger,
		);
	}

	public getVersion(): Promise<string> {
		const url = this.getUrlForAction('version');

		return DeviceAPI.promisifiedRequest({
			method: 'GET',
			url,
			json: true,
		}).then((body) => {
			if (body.status !== 'success') {
				throw new ApiErrors.DeviceAPIError(
					'Non-successful response from supervisor version endpoint',
				);
			}

			return body.version;
		});
	}

	public getStatus(): Promise<Status> {
		const url = this.getUrlForAction('status');

		return DeviceAPI.promisifiedRequest({
			method: 'GET',
			url,
			json: true,
		}).then((body) => {
			if (body.status !== 'success') {
				throw new ApiErrors.DeviceAPIError(
					'Non-successful response from supervisor status endpoint',
				);
			}

			return _.omit(body, 'status') as Status;
		});
	}

	public getLogStream(): Promise<Stream.Readable> {
		const url = this.getUrlForAction('logs');

		// Don't use the promisified version here as we want to stream the output
		return new Promise((resolve, reject) => {
			const req = request.get(url);

			req.on('error', reject).on('response', async (res) => {
				if (res.statusCode !== 200) {
					reject(
						new ApiErrors.DeviceAPIError(
							'Non-200 response from log streaming endpoint',
						),
					);
					return;
				}
				try {
					res.socket.setKeepAlive(true, 1000);
				} catch (error) {
					reject(error);
				}
				resolve(res);
			});
		});
	}

	private getUrlForAction(action: keyof typeof deviceEndpoints): string {
		return `${this.deviceAddress}${deviceEndpoints[action]}`;
	}

	// A helper method for promisifying general (non-streaming) requests. Streaming
	// requests should use a seperate setup
	private static async promisifiedRequest<
		T extends Parameters<typeof request>[0],
	>(opts: T, logger?: Logger): Promise<any> {
		interface ObjectWithUrl {
			url?: string;
		}

		if (logger != null) {
			let url: string | null = null;
			if (_.isObject(opts) && (opts as ObjectWithUrl).url != null) {
				// the `as string` shouldn't be necessary, but the type system
				// is getting a little confused
				url = (opts as ObjectWithUrl).url as string;
			} else if (typeof opts === 'string') {
				url = opts;
			}

			if (url != null) {
				logger.logDebug(`Sending request to ${url}`);
			}
		}

		const doRequest = async () => {
			return await new Promise((resolve, reject) => {
				return request(opts, (err, response, body) => {
					if (err) {
						return reject(err);
					}
					switch (response.statusCode) {
						case 200:
							return resolve(body);
						case 400:
							return reject(
								new ApiErrors.BadRequestDeviceAPIError(body.message),
							);
						case 503:
							return reject(
								new ApiErrors.ServiceUnavailableAPIError(body.message),
							);
						default:
							return reject(new ApiErrors.DeviceAPIError(body.message));
					}
				});
			});
		};

		return await retry({
			func: doRequest,
			initialDelayMs: 2000,
			maxAttempts: 6,
			label: `Supervisor API (${opts.method} ${(opts as any).url})`,
		});
	}
}

export default DeviceAPI;
