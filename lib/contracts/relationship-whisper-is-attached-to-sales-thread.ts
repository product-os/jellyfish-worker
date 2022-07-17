import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipWhisperIsAttachedToSalesThread: RelationshipContractDefinition =
	{
		slug: 'relationship-whisper-is-attached-to-sales-thread',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Whisper',
			inverseTitle: 'Sales thread',
			from: {
				type: 'whisper',
			},
			to: {
				type: 'sales-thread',
			},
		},
	};
