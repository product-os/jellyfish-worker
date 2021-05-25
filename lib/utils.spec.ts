/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as utils from './utils';
import { core } from '@balena/jellyfish-types';

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
		} as any as core.ActionContract);

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
		} as any as core.ActionContract);

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
		} as any as core.ActionContract);

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
