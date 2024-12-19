/**
 * @license
 * Copyright 2018-2021 Balena Ltd.
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
import ColorHash = require('color-hash');
import _ from 'lodash';
import type { Readable } from 'stream';

import { getChalk } from '../lazy.js';
import type Logger from '../logger.js';
import { ExpectedError, SIGINTError } from '../../errors.js';

class DeviceConnectionLostError extends ExpectedError {
	public static defaultMsg = 'Connection to device lost';
	constructor(msg?: string) {
		super(msg || DeviceConnectionLostError.defaultMsg);
	}
}

interface Log {
	message: string;
	timestamp?: number;
	serviceName?: string;

	// There's also a serviceId and imageId, but they're
	// meaningless in local mode
}

interface BuildLog {
	serviceName: string;
	message: string;
}

/**
 * Display logs from a device logging stream. This function will return
 * when the log stream ends.
 *
 * @param logs A stream which produces newline seperated log
 * 	objects
 * @param logger A Logger instance which the logs will be
 * 	displayed through
 * @param system Only show system (and potentially the
 * 	filterService) logs
 * @param filterService Filter the logs so that only logs
 * 	from a single service will be displayed
 */
async function displayDeviceLogs(
	logs: Readable,
	logger: Logger,
	system: boolean,
	filterServices?: string[],
): Promise<void> {
	const { addSIGINTHandler } = await import('../helpers.js');
	const { parse: ndjsonParse } = await import('ndjson');
	let gotSignal = false;
	const handleSignal = () => {
		gotSignal = true;
		logs.emit('close');
	};
	addSIGINTHandler(handleSignal);
	process.once('SIGTERM', handleSignal);
	try {
		await new Promise((_resolve, reject) => {
			const jsonStream = ndjsonParse();
			jsonStream.on('data', (log) => {
				displayLogObject(log, logger, system, filterServices);
			});
			jsonStream.on('error', (e) => {
				logger.logWarn(`Error parsing NDJSON log chunk: ${e}`);
			});
			logs.once('error', handleError);
			logs.once('end', handleError);
			logs.pipe(jsonStream);

			function handleError(error?: Error | string) {
				logger.logWarn(DeviceConnectionLostError.defaultMsg);
				if (gotSignal) {
					reject(new SIGINTError('Log streaming aborted on SIGINT signal'));
				} else {
					const msg = typeof error === 'string' ? error : error?.message;
					reject(new DeviceConnectionLostError(msg));
				}
			}
		});
	} finally {
		process.removeListener('SIGINT', handleSignal);
		process.removeListener('SIGTERM', handleSignal);
	}
}

/**
 * Open a TCP connection to the device's supervisor (TCP port 48484) and tail
 * (display) device logs. Retry (reconnect) up to maxAttempts times if the
 * TCP connection drops. Don't retry on SIGINT (CTRL-C).
 * See function `displayDeviceLogs` for parameter documentation.
 */
export async function connectAndDisplayDeviceLogs({
	deviceApi,
	logger,
	system,
	filterServices,
	maxAttempts = 3,
}: {
	deviceApi: import('./api.js').DeviceAPI;
	logger: Logger;
	system: boolean;
	filterServices?: string[];
	maxAttempts?: number;
}) {
	async function connectAndDisplay() {
		// Open a new connection to the device's supervisor, TCP port 48484
		const logStream = await deviceApi.getLogStream();
		return displayDeviceLogs(logStream, logger, system, filterServices);
	}

	const { retry } = await import('../../utils/helpers.js');
	try {
		await retry({
			func: connectAndDisplay,
			maxAttempts,
			label: 'Streaming logs',
		});
	} catch (err) {
		if (err instanceof DeviceConnectionLostError) {
			err.message = `Max retry count (${
				maxAttempts - 1
			}) exceeded while attempting to reconnect to the device`;
		}
		throw err;
	}
}

export function displayBuildLog(log: BuildLog, logger: Logger): void {
	const toPrint = `${getServiceColourFn(log.serviceName)(
		`[${log.serviceName}]`,
	)} ${log.message}`;
	logger.logBuild(toPrint);
}

export function displayLogObject<T extends Log>(
	obj: T,
	logger: Logger,
	system: boolean,
	filterServices?: string[],
): void {
	const d = obj.timestamp != null ? new Date(obj.timestamp) : new Date();
	let toPrint = `[${d.toISOString()}]`;

	if (obj.serviceName != null) {
		if (filterServices) {
			if (!_.includes(filterServices, obj.serviceName)) {
				return;
			}
		} else if (system) {
			return;
		}

		const colourFn = getServiceColourFn(obj.serviceName);

		toPrint += ` ${colourFn(`[${obj.serviceName}]`)}`;
	} else if (filterServices != null && !system) {
		// We have a system log here but we are filtering based
		// on a service, so drop this too
		return;
	}

	toPrint += ` ${obj.message}`;

	logger.logLogs(toPrint);
}

export const getServiceColourFn = _.memoize(_getServiceColourFn);

const colorHash = new ColorHash();
function _getServiceColourFn(serviceName: string): (msg: string) => string {
	const [r, g, b] = colorHash.rgb(serviceName);

	return getChalk().rgb(r, g, b);
}
