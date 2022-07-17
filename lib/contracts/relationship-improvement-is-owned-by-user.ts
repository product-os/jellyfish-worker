import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipImprovementIsOwnedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-improvement-is-owned-by-user',
		type: 'relationship@1.0.0',
		name: 'is owned by',
		data: {
			inverseName: 'owns',
			title: 'Owner',
			inverseTitle: 'Owned improvement',
			from: {
				type: 'improvement',
			},
			to: {
				type: 'user',
			},
		},
	};
