import { EOL as eol } from 'os';
import _ = require('lodash');
import chalk from 'chalk';
import { StreamLogger } from 'resin-stream-logger';

class Logger {
	public streams: {
		build: NodeJS.ReadWriteStream;
		info: NodeJS.ReadWriteStream;
		debug: NodeJS.ReadWriteStream;
		success: NodeJS.ReadWriteStream;
		warn: NodeJS.ReadWriteStream;
		error: NodeJS.ReadWriteStream;
	};

	public formatMessage: (name: string, message: string) => string;

	constructor() {
		const logger = new StreamLogger();
		logger.addPrefix('build', chalk.blue('[Build]'));
		logger.addPrefix('info', chalk.cyan('[Info]'));
		logger.addPrefix('debug', chalk.magenta('[Debug]'));
		logger.addPrefix('success', chalk.green('[Success]'));
		logger.addPrefix('warn', chalk.yellow('[Warn]'));
		logger.addPrefix('error', chalk.red('[Error]'));

		this.streams = {
			build: logger.createLogStream('build'),
			info: logger.createLogStream('info'),
			debug: logger.createLogStream('debug'),
			success: logger.createLogStream('success'),
			warn: logger.createLogStream('warn'),
			error: logger.createLogStream('error'),
		};

		_.forEach(this.streams, function(stream, key) {
			if (key !== 'debug' || process.env.DEBUG) {
				stream.pipe(process.stdout);
			}
		});

		this.formatMessage = logger.formatWithPrefix.bind(logger);
	}

	logInfo(msg: string) {
		return this.streams.info.write(msg + eol);
	}

	logDebug(msg: string) {
		return this.streams.debug.write(msg + eol);
	}

	logSuccess(msg: string) {
		return this.streams.success.write(msg + eol);
	}

	logWarn(msg: string) {
		return this.streams.warn.write(msg + eol);
	}

	logError(msg: string) {
		return this.streams.error.write(msg + eol);
	}

	logBuild(msg: string) {
		return this.streams.build.write(msg + eol);
	}
}

export = Logger;
