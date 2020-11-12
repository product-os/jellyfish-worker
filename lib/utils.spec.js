/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const utils = require('./utils')

ava('durationToMs converts a duration to milliseconds', (test) => {
	const duration = 'PT1H'
	const durationMs = utils.durationToMs(duration)
	test.is(durationMs, 3600000)
})

ava('durationToMs returns 0 if duration is invalid', (test) => {
	const duration = 'BLAH'
	const durationMs = utils.durationToMs(duration)
	test.is(durationMs, 0)
})

ava('.getActionArgumentsSchema() should return a wildcard schema if no args', (test) => {
	const schema = utils.getActionArgumentsSchema({
		data: {
			arguments: {}
		}
	})

	test.deepEqual(schema, {
		type: 'object'
	})
})

ava('.getActionArgumentsSchema() should parse one argument', (test) => {
	const schema = utils.getActionArgumentsSchema({
		data: {
			arguments: {
				foo: {
					type: 'object'
				}
			}
		}
	})

	test.deepEqual(schema, {
		type: 'object',
		properties: {
			foo: {
				type: 'object'
			}
		},
		additionalProperties: false,
		required: [ 'foo' ]
	})
})

ava('.getActionArgumentsSchema() should parse two arguments', (test) => {
	const schema = utils.getActionArgumentsSchema({
		data: {
			arguments: {
				foo: {
					type: 'object'
				},
				bar: {
					type: 'number'
				}
			}
		}
	})

	test.deepEqual(schema, {
		type: 'object',
		properties: {
			foo: {
				type: 'object'
			},
			bar: {
				type: 'number'
			}
		},
		additionalProperties: false,
		required: [ 'foo', 'bar' ]
	})
})
