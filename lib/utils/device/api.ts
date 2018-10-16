import * as Bluebird from 'bluebird';
import * as request from 'request';
import * as Stream from 'stream';

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

const deviceEndpoints = {
	setTargetState: 'v2/local/target-state',
	getTargetState: 'v2/local/target-state',
	getDeviceInformation: 'v2/local/device-info',
	logs: 'v2/local/logs',
	ping: 'ping',
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
			request.post,
			{
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
			request.get,
			{
				url,
				json: true,
			},
			this.logger,
		).then(body => {
			return body.state;
		});
	}

	public async getDeviceInformation(): Promise<DeviceInfo> {
		const url = this.getUrlForAction('getDeviceInformation');

		return DeviceAPI.promisifiedRequest(
			request.get,
			{
				url,
				json: true,
			},
			this.logger,
		).then(body => {
			return body.info;
		});
	}

	public async ping(): Promise<void> {
		const url = this.getUrlForAction('ping');

		return DeviceAPI.promisifiedRequest(
			request.get,
			{
				url,
			},
			this.logger,
		);
	}

	public getLogStream(): Bluebird<Stream.Readable> {
		const url = this.getUrlForAction('logs');

		// Don't use the promisified version here as we want to stream the output
		return new Bluebird((resolve, reject) => {
			const req = request.get(url);

			req.on('error', reject).on('response', res => {
				if (res.statusCode !== 200) {
					reject(
						new ApiErrors.DeviceAPIError(
							'Non-200 response from log streaming endpoint',
						),
					);
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
	private static async promisifiedRequest<T>(
		requestMethod: (
			opts: T,
			cb: (err?: any, res?: any, body?: any) => void,
		) => void,
		opts: T,
		logger?: Logger,
	): Promise<any> {
		const Bluebird = await import('bluebird');
		const _ = await import('lodash');

		type ObjectWithUrl = { url?: string };

		if (logger != null) {
			let url: string | null = null;
			if (_.isObject(opts) && (opts as ObjectWithUrl).url != null) {
				// the `as string` shouldn't be necessary, but the type system
				// is getting a little confused
				url = (opts as ObjectWithUrl).url as string;
			} else if (_.isString(opts)) {
				url = opts;
			}

			if (url != null) {
				logger.logDebug(`Sending request to ${url}`);
			}
		}

		return Bluebird.fromCallback(
			cb => {
				return requestMethod(opts, cb);
			},
			{ multiArgs: true },
		).then(([response, body]) => {
			switch (response.statusCode) {
				case 200:
					return body;
				case 400:
					throw new ApiErrors.BadRequestDeviceAPIError(body.message);
				case 503:
					throw new ApiErrors.ServiceUnavailableAPIError(body.message);
				default:
					throw new ApiErrors.DeviceAPIError(body.message);
			}
		});
	}
}

export default DeviceAPI;
