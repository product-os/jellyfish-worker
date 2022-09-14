import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipImprovementIsAttachedToProduct: RelationshipContractDefinition =
	{
		slug: 'relationship-improvement-is-attached-to-product',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached',
			title: 'Product',
			inverseTitle: 'Improvement',
			from: {
				type: 'improvement',
			},
			to: {
				type: 'product',
			},
		},
	};
