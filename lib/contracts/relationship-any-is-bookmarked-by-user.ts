import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipAnyIsBookmarkedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-any-is-bookmarked-by-user',
		type: 'relationship@1.0.0',
		name: 'is bookmarked by',
		data: {
			inverseName: 'bookmarked',
			title: 'Bookmarked by user',
			inverseTitle: 'Bookmarked contract',
			from: {
				type: '*',
			},
			to: {
				type: 'user',
			},
		},
	};
