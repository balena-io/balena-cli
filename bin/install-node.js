var binary = require('node-binary');
var fs = require('fs');
var path = require('path');
var nodeVersion = require('../package.json').bundled_engine;
var destination = './bin/node';

var os = process.env.RESIN_OS || process.platform;
var arch = process.env.RESIN_ARCH || process.arch;

console.log('Downloading node-' + nodeVersion + '-' + os + '-' + arch);

binary.download({
	os: os,
	arch: arch,
	version: nodeVersion
}, destination, function(error, binaryPath) {
	if(error) {
		console.error(error.message);
		process.exit(1);
	}

	var output = path.join(destination, 'node-' + os + '-' + arch);

	if(process.platform === 'win32') {
		output += '.exe';
	}

	fs.renameSync(binaryPath, output);

	console.log('NodeJS downloaded to ' + output);
});
