import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipPasswordResetIsAttachedToUser: RelationshipContractDefinition =
	{
		slug: 'relationship-password-reset-is-attached-to-user',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has requested',
			title: 'Password reset',
			inverseTitle: 'User',
			from: {
				type: 'password-reset',
			},
			to: {
				type: 'user',
			},
		},
	};
