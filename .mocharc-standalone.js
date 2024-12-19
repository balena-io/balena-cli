const commonConfig = require('./.mocharc.cjs');

module.exports = {
	...commonConfig,
	spec: ['tests/auth/*.spec.ts', 'tests/commands/**/*.spec.ts'],
};
