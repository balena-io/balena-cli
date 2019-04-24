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
 * @param logs A stream which produces newline seperated log objects
 */
export function displayDeviceLogs(
	logs: Readable,
	logger: Logger,
): Bluebird<void> {
	return new Bluebird((resolve, reject) => {
		logs.on('data', log => {
			displayLogLine(log, logger);
		});

		logs.on('error', reject);
		logs.on('end', resolve);
	});
}

export function displayBuildLog(log: BuildLog, logger: Logger): void {
	const toPrint = `${getServiceColourFn(log.serviceName)(
		`[${log.serviceName}]`,
	)} ${log.message}`;
	logger.logBuild(toPrint);
}

// mutates serviceColours
function displayLogLine(log: string | Buffer, logger: Logger): void {
	try {
		const obj: Log = JSON.parse(log.toString());
		displayLogObject(obj, logger);
	} catch (e) {
		logger.logDebug(`Dropping device log due to failed parsing: ${e}`);
	}
}

export function displayLogObject(obj: Log, logger: Logger): void {
	let toPrint: string;
	if (obj.timestamp != null) {
		toPrint = `[${new Date(obj.timestamp).toLocaleString()}]`;
	} else {
		toPrint = `[${new Date().toLocaleString()}]`;
	}

	if (obj.serviceName != null) {
		const colourFn = getServiceColourFn(obj.serviceName);

		toPrint += ` ${colourFn(`[${obj.serviceName}]`)}`;
	}

	toPrint += ` ${obj.message}`;

	logger.logLogs(toPrint);
}

const getServiceColourFn = _.memoize(_getServiceColourFn);

const colorHash = new ColorHash();
function _getServiceColourFn(serviceName: string): (msg: string) => string {
	const [r, g, b] = colorHash.rgb(serviceName);

	return chalk.rgb(r, g, b);
}
