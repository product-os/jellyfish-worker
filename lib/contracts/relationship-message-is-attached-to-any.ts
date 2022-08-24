import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipMessageIsAttachedToAny: RelationshipContractDefinition =
	{
		slug: 'relationship-message-is-attached-to-any',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			inverseTitle: 'Message',
			title: 'Contract',
			from: {
				type: 'message',
			},
			to: {
				type: '*',
			},
		},
	};
