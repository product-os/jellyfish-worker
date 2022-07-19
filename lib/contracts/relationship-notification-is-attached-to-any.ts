import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipNotificationIsAttachedToAny: RelationshipContractDefinition =
	{
		slug: 'relationship-notification-is-attached-to-any',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached',
			title: 'Target',
			inverseTitle: 'Notification',
			from: {
				type: 'notification',
			},
			to: {
				type: '*',
			},
		},
	};
