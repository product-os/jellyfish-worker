import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipReactionIsAttachedToMessage: RelationshipContractDefinition =
	{
		slug: 'relationship-reaction-is-attached-to-message',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Reaction',
			inverseTitle: 'Message',
			from: {
				type: 'reaction',
			},
			to: {
				type: 'message',
			},
		},
	};
