import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipUpdateIsAttachedToAny: RelationshipContractDefinition =
	{
		slug: 'relationship-update-is-attached-to-any',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Update',
			inverseTitle: 'Updated',
			from: {
				type: 'update',
			},
			to: {
				type: '*',
			},
		},
	};
