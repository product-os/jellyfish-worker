import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipTriggeredActionOwnsTask: RelationshipContractDefinition =
	{
		slug: 'relationship-triggered-action-owns-task',
		type: 'relationship@1.0.0',
		name: 'owns',
		data: {
			inverseName: 'is owned by',
			title: 'Owned task',
			inverseTitle: 'Loop',
			from: {
				type: 'triggered-action',
			},
			to: {
				type: 'task',
			},
		},
	};
