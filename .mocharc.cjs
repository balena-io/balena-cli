module.exports = {
	reporter: 'spec',
	require: 'ts-node/register/transpile-only',
	file: './tests/config-tests',
	timeout: 48000,
	// To test only, say, 'push.spec.ts', do it as follows so that
	// requests are authenticated:
	// spec: ['tests/auth/*.spec.ts', 'tests/**/deploy.spec.ts'],
	spec: 'tests/**/*.spec.ts',
};
