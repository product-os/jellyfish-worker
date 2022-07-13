import { mergeIncrements } from '../../../lib/actions/action-increment-tag';
import type { ContractSummary } from 'autumndb';

describe('mergeIncrements()', () => {
	test('should ignore null items', () => {
		const set: ContractSummary[] = [];
		const item = null;
		mergeIncrements(set, item);
		expect(set.length).toBe(0);
	});

	test('should push ContractSummary items', () => {
		const set: ContractSummary[] = [];
		const item: ContractSummary = {
			id: '1234',
			slug: 'card-1234',
			version: '1.0.0',
			type: 'card@1.0.0',
		};
		mergeIncrements(set, item);
		expect(set.length).toBe(1);
	});

	test('should handle ContractSummary arrays', () => {
		const set: ContractSummary[] = [];
		const items: ContractSummary[] = [
			{
				id: '1234',
				slug: 'card-1234',
				version: '1.0.0',
				type: 'card@1.0.0',
			},
			{
				id: '5678',
				slug: 'card-5678',
				version: '1.0.0',
				type: 'card@1.0.0',
			},
		];
		mergeIncrements(set, items);
		expect(set.length).toBe(2);
	});
});
