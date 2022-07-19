import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipAccountIsOwnedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-account-is-owned-by-user',
		type: 'relationship@1.0.0',
		name: 'is owned by',
		data: {
			inverseName: 'owns',
			title: 'Owner',
			inverseTitle: 'Owned account',
			from: {
				type: 'account',
			},
			to: {
				type: 'user',
			},
		},
	};
