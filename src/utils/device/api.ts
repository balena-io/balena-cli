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
import { retry } from '../helpers.js';
import Logger = require('../logger');
import * as ApiErrors from './errors.js';
import { getBalenaSdk } from '../lazy.js';
import type { BalenaSDK } from 'balena-sdk';

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
		port = 48484,
	) {
		// Allow override for testing with mock servers
		this.deviceAddress =
			process.env.BALENARC_SUPERVISOR_ADDRESS ?? `http://${addr}:${port}/`;
	}

	// Either return nothing, or throw an error with the info
	public async setTargetState(state: Record<string, any>) {
		const url = this.getUrlForAction('setTargetState');
		await DeviceAPI.sendRequest(
			{
				method: 'POST',
				url,
				json: true,
				body: state,
			},
			this.logger,
		);
	}

	public async getTargetState() {
		const url = this.getUrlForAction('getTargetState');

		return await DeviceAPI.sendRequest(
			{
				method: 'GET',
				url,
				json: true,
			},
			this.logger,
		).then(({ state }: { state: Record<string, any> }) => {
			return state;
		});
	}

	public async getDeviceInformation() {
		const url = this.getUrlForAction('getDeviceInformation');

		return await DeviceAPI.sendRequest(
			{
				method: 'GET',
				url,
				json: true,
			},
			this.logger,
		).then(({ info }: { info: DeviceInfo }) => {
			return info;
		});
	}

	public async getContainerId(serviceName: string): Promise<string> {
		const url = this.getUrlForAction('containerId');

		const body = await DeviceAPI.sendRequest(
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

	public async ping() {
		const url = this.getUrlForAction('ping');

		await DeviceAPI.sendRequest(
			{
				method: 'GET',
				url,
			},
			this.logger,
		);
	}

	public async getVersion(): Promise<string> {
		const url = this.getUrlForAction('version');

		return await DeviceAPI.sendRequest({
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

	public async getStatus() {
		const url = this.getUrlForAction('status');

		return await DeviceAPI.sendRequest({
			method: 'GET',
			url,
			json: true,
		}).then((body) => {
			if (body.status !== 'success') {
				throw new ApiErrors.DeviceAPIError(
					'Non-successful response from supervisor status endpoint',
				);
			}

			delete body.status;
			return body as Status;
		});
	}

	public async getLogStream() {
		const url = this.getUrlForAction('logs');
		const sdk = getBalenaSdk();

		const stream = await sdk.request.stream({ url });
		stream.on('response', (res) => {
			if (res.statusCode !== 200) {
				throw new ApiErrors.DeviceAPIError(
					'Non-200 response from log streaming endpoint',
				);
			}
			res.socket.setKeepAlive(true, 1000);
		});
		return stream;
	}

	private getUrlForAction(action: keyof typeof deviceEndpoints) {
		return `${this.deviceAddress}${deviceEndpoints[action]}`;
	}

	// A helper method for promisifying general (non-streaming) requests. Streaming
	// requests should use a seperate setup
	private static async sendRequest(
		opts: Parameters<BalenaSDK['request']['send']>[number],
		logger?: Logger,
	) {
		if (logger != null && opts.url != null) {
			logger.logDebug(`Sending request to ${opts.url}`);
		}

		const sdk = getBalenaSdk();
		const doRequest = async () => {
			const response = await sdk.request.send(opts);
			const bodyError =
				typeof response.body === 'string'
					? response.body
					: response.body.message;
			switch (response.statusCode) {
				case 200:
					return response.body;
				case 400:
					throw new ApiErrors.BadRequestDeviceAPIError(bodyError);
				case 503:
					throw new ApiErrors.ServiceUnavailableAPIError(bodyError);
				default:
					new ApiErrors.DeviceAPIError(bodyError);
			}
		};

		return await retry({
			func: doRequest,
			initialDelayMs: 2000,
			maxAttempts: 6,
			label: `Supervisor API (${opts.method} ${opts.url})`,
		});
	}
}
