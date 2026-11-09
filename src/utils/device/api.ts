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
import * as http from 'http';
import type { IncomingMessage } from 'http';

import { retry } from '../helpers';
import Logger = require('../logger');
import * as ApiErrors from './errors';

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

interface DeviceRequest {
	method: 'GET' | 'POST';
	url: string;
	json?: boolean;
	body?: Record<string, any>;
	qs?: Record<string, string>;
}

export class DeviceAPI {
	private deviceAddress: string;

	/**
	 * @param agent Carries every request, e.g. over SSH; see connectToDevice()
	 */
	public constructor(
		private logger: Logger,
		addr: string,
		private agent: http.Agent,
		port = 48484,
	) {
		// Allow override for testing with mock servers
		this.deviceAddress =
			process.env.BALENARC_SUPERVISOR_ADDRESS ?? `http://${addr}:${port}/`;
	}

	// Either return nothing, or throw an error with the info
	public async setTargetState(state: Record<string, any>) {
		const url = this.getUrlForAction('setTargetState');
		await this.sendRequest({
			method: 'POST',
			url,
			json: true,
			body: state,
		});
	}

	public async getTargetState() {
		const url = this.getUrlForAction('getTargetState');

		return await this.sendRequest({
			method: 'GET',
			url,
			json: true,
		}).then(({ state }: { state: Record<string, any> }) => {
			return state;
		});
	}

	public async getDeviceInformation() {
		const url = this.getUrlForAction('getDeviceInformation');

		return await this.sendRequest({
			method: 'GET',
			url,
			json: true,
		}).then(({ info }: { info: DeviceInfo }) => {
			return info;
		});
	}

	public async getContainerId(serviceName: string): Promise<string> {
		const url = this.getUrlForAction('containerId');

		const body = await this.sendRequest({
			method: 'GET',
			url,
			json: true,
			qs: {
				serviceName,
			},
		});

		if (body.status !== 'success') {
			throw new ApiErrors.DeviceAPIError(
				'Non-successful response from supervisor containerId endpoint',
			);
		}
		return body.containerId;
	}

	public async ping() {
		const url = this.getUrlForAction('ping');

		await this.sendRequest({
			method: 'GET',
			url,
		});
	}

	public async getVersion(): Promise<string> {
		const url = this.getUrlForAction('version');

		return await this.sendRequest({
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

		return await this.sendRequest({
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

	public async getLogStream(): Promise<IncomingMessage> {
		const res = await this.openRequest({
			method: 'GET',
			url: this.getUrlForAction('logs'),
		});
		if (res.statusCode !== 200) {
			res.resume();
			throw new ApiErrors.DeviceAPIError(
				'Non-200 response from log streaming endpoint',
			);
		}
		return res;
	}

	private getUrlForAction(action: keyof typeof deviceEndpoints) {
		return `${this.deviceAddress}${deviceEndpoints[action]}`;
	}

	private openRequest({
		method,
		url,
		json,
		body,
		qs,
	}: DeviceRequest): Promise<IncomingMessage> {
		const target = new URL(url);
		for (const [key, value] of Object.entries(qs ?? {})) {
			target.searchParams.set(key, value);
		}
		const payload = json && body != null ? JSON.stringify(body) : undefined;
		return new Promise((resolve, reject) => {
			const req = http.request(
				target,
				{
					method,
					agent: this.agent,
					headers:
						payload != null
							? {
									'Content-Type': 'application/json',
									'Content-Length': Buffer.byteLength(payload),
								}
							: {},
				},
				resolve,
			);
			req.once('error', reject);
			req.end(payload);
		});
	}

	private async readResponse(req: DeviceRequest) {
		const res = await this.openRequest(req);
		let text = '';
		for await (const chunk of res) {
			text += chunk;
		}
		const isJson = (res.headers['content-type'] ?? '').includes(
			'application/json',
		);
		return {
			statusCode: res.statusCode,
			body: isJson ? JSON.parse(text) : text,
		};
	}

	// A helper method for general (non-streaming) requests
	private async sendRequest(opts: DeviceRequest) {
		this.logger.logDebug(`Sending request to ${opts.url}`);

		const doRequest = async () => {
			const response = await this.readResponse(opts);
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
