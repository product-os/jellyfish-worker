import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipSubscriptionIsAttachedToAny: RelationshipContractDefinition =
	{
		slug: 'relationship-subscription-is-attached-to-any',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached',
			title: 'Target',
			inverseTitle: 'Subscription',
			from: {
				type: 'subscription',
			},
			to: {
				type: '*',
			},
		},
	};
