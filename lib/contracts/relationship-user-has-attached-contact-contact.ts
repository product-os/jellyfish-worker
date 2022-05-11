import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipUserHasAttachedContactContact: RelationshipContractDefinition =
	{
		slug: 'relationship-user-has-attached-contact-contact',
		type: 'relationship@1.0.0',
		name: 'has attached contact',
		data: {
			inverseName: 'is attached to user',
			title: 'Attached contact',
			inverseTitle: 'Attached user',
			from: {
				type: 'user',
			},
			to: {
				type: 'contact',
			},
		},
	};
