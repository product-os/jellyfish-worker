import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipPatternIsAttachedToSalesThread: RelationshipContractDefinition =
	{
		slug: 'relationship-pattern-is-attached-to-sales-thread',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached',
			title: 'Sales thread',
			inverseTitle: 'Pattern',
			from: {
				type: 'pattern',
			},
			to: {
				type: 'sales-thread',
			},
		},
	};
