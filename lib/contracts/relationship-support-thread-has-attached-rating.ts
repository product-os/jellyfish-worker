import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipSupportThreadHasAttachedRating: RelationshipContractDefinition =
	{
		slug: 'relationship-support-thread-has-attached-rating',
		type: 'relationship@1.0.0',
		name: 'has attached',
		data: {
			inverseName: 'is attached to',
			title: 'Rating',
			inverseTitle: 'Support thread',
			from: {
				type: 'support-thread',
			},
			to: {
				type: 'rating',
			},
		},
	};
