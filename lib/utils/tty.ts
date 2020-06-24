const windowSize: { width?: number; height?: number } = {};

const updateWindowSize = () => {
	const size = require('window-size')?.get();
	windowSize.width = size?.width;
	windowSize.height = size?.height;
};

process.stdout.on('resize', updateWindowSize);

export = (stream: NodeJS.WriteStream = process.stdout) => {
	// make sure we get initial metrics
	updateWindowSize();

	const currentWindowSize = () => {
		// always return a copy.
		// width/height can be undefined if no TTY.
		return {
			width: windowSize.width,
			height: windowSize.height,
		};
	};

	const hideCursor = () => stream.write('\u001B[?25l');

	const showCursor = () => stream.write('\u001B[?25h');

	const cursorUp = (rows: number = 0) => stream.write(`\u001B[${rows}A`);

	const cursorDown = (rows: number = 0) => stream.write(`\u001B[${rows}B`);

	const cursorHidden = () => {
		const Bluebird = require('bluebird') as typeof import('bluebird');
		return Bluebird.try(hideCursor).disposer(() => {
			showCursor();
		});
	};

	const write = (str: string) => stream.write(str);

	const writeLine = (str: string) => stream.write(`${str}\n`);

	const clearLine = () => stream.write('\u001B[2K\r');

	const replaceLine = (str: string) => {
		clearLine();
		return write(str);
	};

	const deleteToEnd = () => stream.write('\u001b[0J');

	return {
		stream,
		currentWindowSize,
		hideCursor,
		showCursor,
		cursorHidden,
		cursorUp,
		cursorDown,
		write,
		writeLine,
		clearLine,
		replaceLine,
		deleteToEnd,
	};
};
