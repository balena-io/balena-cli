import * as Bluebird from 'bluebird';
import chalk from 'chalk';
import ColorHash = require('color-hash');
import * as _ from 'lodash';
import { Readable } from 'stream';

import Logger = require('../logger');

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
export function displayDeviceLogs(
	logs: Readable,
	logger: Logger,
	system: boolean,
	filterServices?: string[],
): Bluebird<void> {
	return new Bluebird((resolve, reject) => {
		logs.on('data', log => {
			displayLogLine(log, logger, system, filterServices);
		});

		logs.on('error', reject);
		logs.on('end', () => {
			logger.logError('Connection to device lost');
			resolve();
		});
	});
}

export function displayBuildLog(log: BuildLog, logger: Logger): void {
	const toPrint = `${getServiceColourFn(log.serviceName)(
		`[${log.serviceName}]`,
	)} ${log.message}`;
	logger.logBuild(toPrint);
}

// mutates serviceColours
function displayLogLine(
	log: string | Buffer,
	logger: Logger,
	system: boolean,
	filterServices?: string[],
): void {
	try {
		const obj: Log = JSON.parse(log.toString());
		displayLogObject(obj, logger, system, filterServices);
	} catch (e) {
		logger.logDebug(`Dropping device log due to failed parsing: ${e}`);
	}
}

export function displayLogObject<T extends Log>(
	obj: T,
	logger: Logger,
	system: boolean,
	filterServices?: string[],
): void {
	let toPrint: string;
	if (obj.timestamp != null) {
		toPrint = `[${new Date(obj.timestamp).toLocaleString()}]`;
	} else {
		toPrint = `[${new Date().toLocaleString()}]`;
	}

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

	return chalk.rgb(r, g, b);
}
