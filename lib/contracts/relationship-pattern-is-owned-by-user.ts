import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipPatternIsOwnedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-pattern-is-owned-by-user',
		type: 'relationship@1.0.0',
		name: 'is owned by',
		data: {
			inverseName: 'owns',
			title: 'Owner',
			inverseTitle: 'Owned pattern',
			from: {
				type: 'pattern',
			},
			to: {
				type: 'user',
			},
		},
	};
