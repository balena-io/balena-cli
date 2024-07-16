module.exports = {
	extends: ['./node_modules/@balena/lint/config/.eslintrc.js'],
	parserOptions: {
		project: 'tsconfig.dev.json',
	},
	root: true,
	rules: {
		ignoreDefinitionFiles: 0,
		// to avoid the `warning  Forbidden non-null assertion  @typescript-eslint/no-non-null-assertion`
		'@typescript-eslint/no-non-null-assertion': 'off',
		'@typescript-eslint/no-shadow': 'off',
		'no-restricted-imports': [
			'error',
			{
				paths: ['resin-cli-visuals', 'chalk', 'common-tags', 'resin-cli-form'],
			},
		],
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
	},
};
