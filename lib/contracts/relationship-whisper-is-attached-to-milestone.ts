import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipWhisperIsAttachedToMilestone: RelationshipContractDefinition =
	{
		slug: 'relationship-whisper-is-attached-to-milestone',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Whisper',
			inverseTitle: 'Milestone',
			from: {
				type: 'whisper',
			},
			to: {
				type: 'milestone',
			},
		},
	};
