import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipWhisperIsAttachedToThread: RelationshipContractDefinition =
	{
		slug: 'relationship-whisper-is-attached-to-thread',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Whisper',
			inverseTitle: 'Thread',
			from: {
				type: 'whisper',
			},
			to: {
				type: 'thread',
			},
		},
	};
