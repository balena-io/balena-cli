var binary = require('node-binary');
var nodeVersion = 'v0.12.0';

console.log('Downloading node-' + nodeVersion + '-' + process.platform + '-' + process.arch);

binary.download({
	os: process.platform,
	arch: process.arch,
	version: nodeVersion
}, './bin/node', function(error, binaryPath) {
	if(error) {
		console.error(error.message);
		process.exit(1);
	}

	console.log('NodeJS was downloaded to ' + binaryPath);
});
