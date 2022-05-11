import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipTransformerWorkerOwnsTask: RelationshipContractDefinition =
	{
		slug: 'relationship-transformer-worker-owns-task',
		type: 'relationship@1.0.0',
		name: 'owns',
		data: {
			inverseName: 'is owned by',
			title: 'Owned task',
			inverseTitle: 'Transformer worker',
			from: {
				type: 'transformer-worker',
			},
			to: {
				type: 'task',
			},
		},
	};
