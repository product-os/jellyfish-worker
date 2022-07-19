import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipReactionIsAttachedToWhisper: RelationshipContractDefinition =
	{
		slug: 'relationship-reaction-is-attached-to-whisper',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Reaction',
			inverseTitle: 'Whisper',
			from: {
				type: 'reaction',
			},
			to: {
				type: 'whisper',
			},
		},
	};
