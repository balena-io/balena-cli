const commonConfig = require('./.mocharc.js');

module.exports = {
	...commonConfig,
	spec: ['tests/auth/*.spec.ts', 'tests/commands/**/*.spec.ts'],
};
