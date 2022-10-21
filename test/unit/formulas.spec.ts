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
