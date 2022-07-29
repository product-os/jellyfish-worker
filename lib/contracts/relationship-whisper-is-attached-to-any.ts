import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipWhisperIsAttachedToAny: RelationshipContractDefinition =
	{
		slug: 'relationship-whisper-is-attached-to-any',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Whisper',
			inverseTitle: 'Contract',
			from: {
				type: 'whisper',
			},
			to: {
				type: '*',
			},
		},
	};
