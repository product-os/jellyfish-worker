import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipSagaHasAttachedImprovement: RelationshipContractDefinition =
	{
		slug: 'relationship-saga-has-attached-improvement',
		type: 'relationship@1.0.0',
		name: 'has attached',
		data: {
			inverseName: 'is attached to',
			title: 'Improvement',
			inverseTitle: 'Saga',
			from: {
				type: 'saga',
			},
			to: {
				type: 'improvement',
			},
		},
	};
