const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
	baseDirectory: __dirname,
});
module.exports = [
	...require('@balena/lint/config/eslint.config'),
	...compat.config({
		parserOptions: {
			project: 'tsconfig.dev.json',
		},
		rules: {
			ignoreDefinitionFiles: 0,
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-shadow': 'off',
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': 'warn',

			'no-restricted-imports': ['error', {
				paths: ['resin-cli-visuals', 'common-tags', 'resin-cli-form'],
			}],

			'@typescript-eslint/no-unused-vars': ['error', {
				argsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
			}],
		},
	}),
];
