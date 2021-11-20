const base = require('@balena/jellyfish-config/config/jest.config')

module.exports = {
	...base,
	testTimeout: 60000,
	transformIgnorePatterns: [
		"/node_modules/(?!@sindresorhus/(.*)|escape-string-regexp)",
	],
	transform: {
		"/node_modules/@sindresorhus/(.*)": 'jest-esm-transformer',
		"/node_modules/escape-string-regexp/(.*)": 'jest-esm-transformer'
	}
};
