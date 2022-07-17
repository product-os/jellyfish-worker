import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipFirstTimeLoginIsAttachedToUser: RelationshipContractDefinition =
	{
		slug: 'relationship-first-time-login-is-attached-to-user',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has requested',
			title: 'First-time login',
			inverseTitle: 'User',
			from: {
				type: 'first-time-login',
			},
			to: {
				type: 'user',
			},
		},
	};
