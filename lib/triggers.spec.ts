/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as triggers from './triggers';

describe('.findUsedPropertyPaths()', () => {
	test('finds all final paths', () => {
		const schema = {
			type: 'object',
			properties: {
				type: { const: 'task@1.0.0' },
				data: {
					type: 'object',
					properties: {
						p1: { type: 'string' },
						p2: {
							type: 'object',
							allOf: [
								{ properties: { alpha: { type: 'number' } } },
								{ properties: { beta: { type: 'boolean' } } },
							],
						},
					},
				},
			},
			anyOf: [
				true,
				{ $$links: { 'is owned by': true } },
				{ properties: { name: { const: 'test' } } },
			],
		};

		const paths = triggers.findUsedPropertyPaths(schema);

		const expectedPaths = [
			'type',
			'data.p1',
			'data.p2.alpha',
			'data.p2.beta',
			'name',
		];
		expectedPaths.forEach((p) => expect(paths).toContain(p));
		expect(paths.length).toEqual(expectedPaths.length);
	});
	test('ignores links', () => {
		const schema = {
			type: 'object',
			properties: {
				type: { const: 'task@1.0.0' },
			},
			$$links: {
				'is owned by': {
					type: 'object',
					properties: {
						slug: { const: 'card-1' },
					},
				},
			},
		};

		const paths = triggers.findUsedPropertyPaths(schema);

		const expectedPaths = ['type'];
		expectedPaths.forEach((p) => expect(paths).toContain(p));
		expect(paths.length).toEqual(expectedPaths.length);
	});
});
