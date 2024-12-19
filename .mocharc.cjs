module.exports = {
	reporter: 'spec',
	require: 'tsx',
	file: './tests/config-tests.ts',
	timeout: 48000,
	// To test only, say, 'push.spec.ts', do it as follows so that
	// requests are authenticated:
	// spec: ['tests/auth/*.spec.ts', 'tests/**/deploy.spec.ts'],
	spec: 'tests/**/*.spec.ts',
};
