import commonConfig from './.mocharc.js';

module.exports = {
	...commonConfig,
	spec: ['tests/auth/*.spec.ts', 'tests/commands/**/*.spec.ts'],
};
