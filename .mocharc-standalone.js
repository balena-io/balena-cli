const commonConfig = require('./.mocharc.js');

module.exports = {
	...commonConfig,
	spec: ['tests/auth/*.spec.ts', 'tests/commands/**/*.spec.ts'],
	// Exclude E2E tests from standalone runs - they download large images and
	// boot VMs which only needs testing once (in source mode). Running twice
	// exhausts disk space on CI runners.
	ignore: ['tests/commands/virtual-device/e2e.spec.ts'],
};
