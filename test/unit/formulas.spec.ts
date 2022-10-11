import { Jellyscript } from '@balena/jellyfish-jellyscript';
import { RelationshipContract, testUtils as aTestUtils } from 'autumndb';
import * as formulas from '../../lib/formulas';

const relationships: RelationshipContract[] = [
	{
		id: aTestUtils.generateRandomId(),
		slug: 'relationship-foo-buz-bar',
		type: 'relationship@1.0.0',
		version: '1.0.0',
		name: 'buz',
		data: {
			inverseName: 'baz',
			title: 'Bar',
			inverseTitle: 'Foo',
			from: {
				type: 'foo',
			},
			to: {
				type: 'bar',
			},
		},
		tags: [],
		markers: [],
		created_at: new Date().toISOString(),
		active: true,
		requires: [],
		capabilities: [],
	},
	{
		id: aTestUtils.generateRandomId(),
		slug: 'relationship-any-is-creator-of-any',
		type: 'relationship@1.0.0',
		version: '1.0.0',
		name: 'is creator of',
		data: {
			inverseName: 'was created by',
			title: 'Creator',
			inverseTitle: 'Contract',
			from: {
				type: '*',
			},
			to: {
				type: '*',
			},
		},
		tags: [],
		markers: [],
		created_at: new Date().toISOString(),
		active: true,
		requires: [],
		capabilities: [],
	},
];

const parser = new Jellyscript({
	formulas: {
		NEEDS: formulas.NEEDS,
		NEEDS_ALL: formulas.NEEDS_ALL,
	},
});

describe('NEEDS', () => {
	test('.evaluateObject() should return never if an error exists for passed-in type', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								data: {
									expectedOutputTypes: ['transformer-type'],
								},
								type: 'error@1.0.0',
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							data: {
								expectedOutputTypes: ['transformer-type'],
							},
							type: 'error@1.0.0',
						},
					],
				},
			},
			mergeable: 'never',
		});
	});

	test('.evaluateObject() should return pending if an error exists but not for the passed-in type', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								data: {
									expectedOutputTypes: ['random-type'],
								},
								type: 'error@1.0.0',
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							data: {
								expectedOutputTypes: ['random-type'],
							},
							type: 'error@1.0.0',
						},
					],
				},
			},
			mergeable: 'pending',
		});
	});

	test('.evaluateObject() should return mergeable if backflow mergeable is "mergeable" and has no error', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: 'mergeable',
									},
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: 'mergeable',
								},
							},
						},
					],
				},
			},
			mergeable: 'mergeable',
		});
	});

	test('.evaluateObject() should return mergeable if backflow mergeable is true and has no error', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: true,
									},
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: true,
								},
							},
						},
					],
				},
			},
			mergeable: 'mergeable',
		});
	});

	test('.evaluateObject() should return pending if backflow mergeable is false and has no error', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: false,
									},
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: false,
								},
							},
						},
					],
				},
			},
			mergeable: 'pending',
		});
	});

	test('.evaluateObject() should return mergeable if backflow mergeable is "mergeable", it has no error and callback succeeds', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula:
							'NEEDS(contract, "transformer-type", function (c) { return c && c.data.foo === "bar" })',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: 'mergeable',
									},
									foo: 'bar',
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: 'mergeable',
								},
								foo: 'bar',
							},
						},
					],
				},
			},
			mergeable: 'mergeable',
		});
	});

	test('.evaluateObject() should return mergeable if backflow mergeable is "mergeable", it has no error and callback fails', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula:
							'NEEDS(contract, "transformer-type", function (c) { return c && c.data.foo === "notbar" })',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: 'mergeable',
									},
									foo: 'bar',
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: 'mergeable',
								},
								foo: 'bar',
							},
						},
					],
				},
			},
			mergeable: 'pending',
		});
	});

	test('.evaluateObject() should return never if an error exists for passed-in type and callback succeeds', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula:
							'NEEDS(contract, "transformer-type", function (c) { return c && c.data.foo === "bar" })',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								data: {
									expectedOutputTypes: ['transformer-type'],
									foo: 'bar',
								},
								type: 'error@1.0.0',
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							data: {
								expectedOutputTypes: ['transformer-type'],
								foo: 'bar',
							},
							type: 'error@1.0.0',
						},
					],
				},
			},
			mergeable: 'never',
		});
	});

	test('.evaluateObject() should return never if an error exists for passed-in type and callback fails', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula:
							'NEEDS(contract, "transformer-type", function (c) { return c && c.data.foo === "notbar" })',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								data: {
									expectedOutputTypes: ['transformer-type'],
									foo: 'bar',
								},
								type: 'error@1.0.0',
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							data: {
								expectedOutputTypes: ['transformer-type'],
								foo: 'bar',
							},
							type: 'error@1.0.0',
						},
					],
				},
			},
			mergeable: 'pending',
		});
	});
});

describe('NEEDS_ALL', () => {
	test('.evaluateObject() should return never if at least one parameter is never', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS_ALL("mergeable", "pending", "never")',
					},
				},
			},
			{
				mergeable: 'random-value',
			},
		);

		expect(result).toEqual({
			mergeable: 'never',
		});
	});

	test('.evaluateObject() should return pending if there is no never parameter and at least one pending', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					mergeable: {
						type: 'string',
						enum: ['pending', 'never', 'mergeable'],
						$$formula: 'NEEDS_ALL("pending", "mergeable")',
					},
				},
			},
			{
				mergeable: 'random-value',
			},
		);

		expect(result).toEqual({
			mergeable: 'pending',
		});
	});

	test('.evaluateObject() should return mergeable if all parameters are mergeable', async () => {
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					mergeable: {
						type: 'string',
						enum: ['pending', 'never', 'mergeable'],
						$$formula: 'NEEDS_ALL("mergeable", "mergeable")',
					},
				},
			},
			{
				mergeable: 'random-value',
			},
		);

		expect(result).toEqual({
			mergeable: 'mergeable',
		});
	});
});

describe('reverseRelationship', () => {
	test('should reverse', async () => {
		const reversed = formulas.reverseRelationship(relationships, 'foo', 'buz');
		expect(reversed['baz']).toBeDefined();
		expect(reversed['baz'][0]?.data.from.type).toEqual('bar');
	});

	test('should reverse inverse', async () => {
		const reversed = formulas.reverseRelationship(relationships, 'bar', 'baz');
		expect(reversed['buz']).toBeDefined();
		expect(reversed['buz'][0]?.data.from.type).toEqual('foo');
	});

	test('should allow "*", aka "any" types', async () => {
		const reversed = formulas.reverseRelationship(
			relationships,
			'some-new-type',
			'is creator of',
		);
		expect(reversed['was created by']).toBeDefined();
		expect(reversed['was created by'][0]?.data.from.type).toEqual('*');
	});

	test('should return empty object for undefined link', async () => {
		const reversed = formulas.reverseRelationship(
			relationships,
			'thread',
			'i made this up',
		);
		expect(reversed).toEqual({});
	});
});
