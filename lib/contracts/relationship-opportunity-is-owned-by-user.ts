import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipOpportunityIsOwnedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-opportunity-is-owned-by-user',
		type: 'relationship@1.0.0',
		name: 'is owned by',
		data: {
			inverseName: 'owns',
			title: 'Owner',
			inverseTitle: 'Owned opportunity',
			from: {
				type: 'opportunity',
			},
			to: {
				type: 'user',
			},
		},
	};
