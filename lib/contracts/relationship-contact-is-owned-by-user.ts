import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipContactIsOwnedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-contact-is-owned-by-user',
		type: 'relationship@1.0.0',
		name: 'is owned by',
		data: {
			inverseName: 'owns',
			title: 'Owner',
			inverseTitle: 'Owned contact',
			from: {
				type: 'contact',
			},
			to: {
				type: 'user',
			},
		},
	};
