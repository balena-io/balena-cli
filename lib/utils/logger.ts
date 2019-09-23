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
import chalk from 'chalk';
import _ = require('lodash');
import { EOL as eol } from 'os';
import { StreamLogger } from 'resin-stream-logger';

/**
 * General purpose logger class with support for log streams and colours.
 * Call `Logger.getLogger()` to retrieve a global shared instance of this
 * class. The `new Logger()` pattern is not recommended because it may lead
 * to Node printing "MaxListenersExceededWarning" warning messages to the
 * console.
 */
class Logger {
	public streams: {
		build: NodeJS.ReadWriteStream;
		info: NodeJS.ReadWriteStream;
		debug: NodeJS.ReadWriteStream;
		success: NodeJS.ReadWriteStream;
		warn: NodeJS.ReadWriteStream;
		error: NodeJS.ReadWriteStream;
		logs: NodeJS.ReadWriteStream;
		livepush: NodeJS.ReadWriteStream;
	};

	public formatMessage: (name: string, message: string) => string;

	protected constructor() {
		const logger = new StreamLogger();
		logger.addPrefix('build', chalk.blue('[Build]'));
		logger.addPrefix('info', chalk.cyan('[Info]'));
		logger.addPrefix('debug', chalk.magenta('[Debug]'));
		logger.addPrefix('success', chalk.green('[Success]'));
		logger.addPrefix('warn', chalk.yellow('[Warn]'));
		logger.addPrefix('error', chalk.red('[Error]'));
		logger.addPrefix('logs', chalk.green('[Logs]'));
		logger.addPrefix('live', chalk.yellow('[Live]'));

		this.streams = {
			build: logger.createLogStream('build'),
			info: logger.createLogStream('info'),
			debug: logger.createLogStream('debug'),
			success: logger.createLogStream('success'),
			warn: logger.createLogStream('warn'),
			error: logger.createLogStream('error'),
			logs: logger.createLogStream('logs'),
			livepush: logger.createLogStream('live'),
		};

		_.forEach(this.streams, function(stream, key) {
			if (key !== 'debug') {
				stream.pipe(process.stdout);
			} else if (process.env.DEBUG) {
				stream.pipe(process.stderr);
			}
		});

		this.formatMessage = logger.formatWithPrefix.bind(logger);
	}

	protected static logger: Logger;

	/** Retrieve a global shared instance of this class */
	public static getLogger() {
		if (!this.logger) {
			this.logger = new Logger();
		}
		return this.logger;
	}

	public logInfo(msg: string) {
		return this.streams.info.write(msg + eol);
	}

	public logDebug(msg: string) {
		return this.streams.debug.write(msg + eol);
	}

	public logSuccess(msg: string) {
		return this.streams.success.write(msg + eol);
	}

	public logWarn(msg: string) {
		return this.streams.warn.write(msg + eol);
	}

	public logError(msg: string) {
		return this.streams.error.write(msg + eol);
	}

	public logBuild(msg: string) {
		return this.streams.build.write(msg + eol);
	}

	public logLogs(msg: string) {
		return this.streams.logs.write(msg + eol);
	}

	public logLivepush(msg: string) {
		return this.streams.livepush.write(msg + eol);
	}
}

export = Logger;
