import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipSupportThreadIsOwnedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-support-thread-is-owned-by-user',
		type: 'relationship@1.0.0',
		name: 'is owned by',
		data: {
			inverseName: 'is owner of',
			title: 'Owner',
			inverseTitle: 'Owned support thread',
			from: {
				type: 'support-thread',
			},
			to: {
				type: 'user',
			},
		},
	};
