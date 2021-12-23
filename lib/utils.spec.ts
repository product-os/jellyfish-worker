import type { JSONSchema } from '@balena/jellyfish-types';
import type {
	ActionContract,
	Contract,
} from '@balena/jellyfish-types/build/core';
import * as utils from './utils';

describe('.durationToMs()', () => {
	test('converts a duration to milliseconds', () => {
		const duration = 'PT1H';
		const durationMs = utils.durationToMs(duration);
		expect(durationMs).toBe(3600000);
	});

	test('returns 0 if duration is invalid', () => {
		const duration = 'BLAH';
		const durationMs = utils.durationToMs(duration);
		expect(durationMs).toBe(0);
	});
});

describe('.getActionArgumentsSchema()', () => {
	test('should return a wildcard schema if no args', () => {
		const schema = utils.getActionArgumentsSchema({
			data: {
				arguments: {},
			},
		} as any as ActionContract);

		expect(schema).toEqual({
			type: 'object',
		});
	});

	test('should parse one argument', () => {
		const schema = utils.getActionArgumentsSchema({
			data: {
				arguments: {
					foo: {
						type: 'object',
					},
				},
			},
		} as any as ActionContract);

		expect(schema).toEqual({
			type: 'object',
			properties: {
				foo: {
					type: 'object',
				},
			},
			additionalProperties: false,
			required: ['foo'],
		});
	});

	test('should parse two arguments', () => {
		const schema = utils.getActionArgumentsSchema({
			data: {
				arguments: {
					foo: {
						type: 'object',
					},
					bar: {
						type: 'number',
					},
				},
			},
		} as any as ActionContract);

		expect(schema).toEqual({
			type: 'object',
			properties: {
				foo: {
					type: 'object',
				},
				bar: {
					type: 'number',
				},
			},
			additionalProperties: false,
			required: ['foo', 'bar'],
		});
	});
});

describe('.getQueryWithOptionalLinks()', () => {
	test('returns a query with all optional links', () => {
		const object = {
			id: 'fake-uuid-kind-of',
			slug: 'test-1',
			data: {
				tags: ['tag1'],
			},
			type: 'test@1.0.0',
			version: '1.0.0',
		} as any as Contract;

		const query = utils.getQueryWithOptionalLinks(object, [
			'is owned by',
			'has attached element',
		]);
		const expected: JSONSchema = {
			type: 'object',
			description: 'Get card with optional links',
			anyOf: [
				true,
				{
					$$links: {
						'is owned by': {
							type: 'object',
							additionalProperties: true,
						},
					},
				},
				{
					$$links: {
						'has attached element': {
							type: 'object',
							additionalProperties: true,
						},
					},
				},
			],
			required: ['id'],
			properties: {
				id: {
					type: 'string',
					const: object.id,
				},
			},
			additionalProperties: true,
		};
		expect(query).toStrictEqual(expected);
	});
});
