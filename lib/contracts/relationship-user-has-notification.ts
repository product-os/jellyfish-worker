import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipUserHasNotification: RelationshipContractDefinition = {
	slug: 'relationship-user-has-notification',
	type: 'relationship@1.0.0',
	name: 'has',
	data: {
		inverseName: 'notifies',
		title: 'Notification',
		inverseTitle: 'User',
		from: {
			type: 'user',
		},
		to: {
			type: 'notification',
		},
	},
};
