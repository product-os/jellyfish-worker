import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipImprovementIsAttachedToPattern: RelationshipContractDefinition =
	{
		slug: 'relationship-improvement-is-attached-to-pattern',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached',
			title: 'Pattern',
			inverseTitle: 'Improvement',
			from: {
				type: 'improvement',
			},
			to: {
				type: 'pattern',
			},
		},
	};
