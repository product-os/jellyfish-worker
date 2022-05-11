import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipContactIsAttachedToUser: RelationshipContractDefinition =
	{
		slug: 'relationship-contact-is-attached-to-user',
		type: 'relationship@1.0.0',
		name: 'is attached to user',
		data: {
			inverseName: 'has contact',
			title: 'Contact',
			inverseTitle: 'User',
			from: {
				type: 'contact',
			},
			to: {
				type: 'user',
			},
		},
	};
