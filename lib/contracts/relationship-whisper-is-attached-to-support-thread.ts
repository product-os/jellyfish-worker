import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipWhisperIsAttachedToSupportThread: RelationshipContractDefinition =
	{
		slug: 'relationship-whisper-is-attached-to-support-thread',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Whisper',
			inverseTitle: 'Support Thread',
			from: {
				type: 'whisper',
			},
			to: {
				type: 'support-thread',
			},
		},
	};
