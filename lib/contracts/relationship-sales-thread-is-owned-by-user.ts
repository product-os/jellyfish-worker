import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipSalesThreadIsOwnedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-sales-thread-is-owned-by-user',
		type: 'relationship@1.0.0',
		name: 'is owned by',
		data: {
			inverseName: 'is owner of',
			title: 'Owner',
			inverseTitle: 'Sales thread',
			from: {
				type: 'sales-thread',
			},
			to: {
				type: 'user',
			},
		},
	};
