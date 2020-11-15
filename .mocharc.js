module.exports = {
	spec: 'tests/commands/app/create.spec.ts',
	reporter: 'spec',
	require: 'ts-node/register/transpile-only',
	file: './tests/config-tests',
	timeout: 12000,
	spec: 'tests/**/*.spec.ts',
};
