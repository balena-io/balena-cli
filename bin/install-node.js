var binary = require('node-binary');
var fs = require('fs');
var path = require('path');
var nodeVersion = require('../package.json').bundled_engine;
var destination = './bin/node';

console.log('Downloading node-' + nodeVersion + '-' + process.platform + '-' + process.arch);

binary.download({
	os: process.platform,
	arch: process.arch,
	version: nodeVersion
}, destination, function(error, binaryPath) {
	if(error) {
		console.error(error.message);
		process.exit(1);
	}

	var output = path.join(destination, 'node-' + process.platform + '-' + process.arch);
	fs.renameSync(binaryPath, output);

	console.log('NodeJS downloaded to ' + output);
});
