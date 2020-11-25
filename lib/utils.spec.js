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

ava('.getReferencedLinkVerbs() returns an array of referenced link verbs', (test) => {
	const typeCard = {
		slug: 'test',
		data: {
			schema: {
				type: 'object',
				required: [
					'data'
				],
				properties: {
					data: {
						type: 'object',
						required: [ 'latestUpdate', 'tags' ],
						properties: {
							ownerId: {
								type: 'string',
								$$formula: 'this.links["is owned by"][0].id'
							},
							latestUpdate: {
								type: 'string',
								$$formula: 'MAX(this.links["has attached element"], PARTIAL(FLIP(PROPERTY), "updated_at"))'
							},
							tags: {
								type: 'array',
								items: {
									type: 'string'
								},
								$$formula: 'AGGREGATE(this.links["has attached element"], PARTIAL(FLIP(PROPERTY), "data.tags"))'
							}
						}
					}
				}
			}
		}
	}
	const linkVerbs = utils.getReferencedLinkVerbs(typeCard)
	test.deepEqual(linkVerbs, [ 'is owned by', 'has attached element' ])
})

ava('.getQueryWithOptionalLinks() returns a query with all optional links', (test) => {
	const object = {
		slug: 'test-1',
		data: {
			tags: [ 'tag1' ]
		},
		type: 'test@1.0.0',
		version: '1.0.0'
	}

	const query = utils.getQueryWithOptionalLinks(object, [ 'is owned by', 'has attached element' ])
	test.deepEqual(query, {
		type: 'object',
		description: 'Get card with optional links',
		anyOf: [
			true,
			{
				$$links: {
					'is owned by': {
						type: 'object',
						additionalProperties: true
					}
				}
			},
			{
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true
					}
				}
			}
		],
		properties: {
			required: [ 'slug' ],
			slug: {
				type: 'string',
				const: object.slug
			}
		},
		additionalProperties: true
	})
})
