import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipSupportThreadHasAttachedSubscription: RelationshipContractDefinition =
	{
		slug: 'relationship-support-thread-has-attached-subscription',
		type: 'relationship@1.0.0',
		name: 'has attached',
		data: {
			inverseName: 'is attached to',
			title: 'Subscription',
			inverseTitle: 'Support thread',
			from: {
				type: 'support-thread',
			},
			to: {
				type: 'subscription',
			},
		},
	};
