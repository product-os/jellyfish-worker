import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipCreateIsAttachedToAny: RelationshipContractDefinition =
	{
		slug: 'relationship-create-is-attached-to-any',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Create',
			inverseTitle: 'Created',
			from: {
				type: 'create',
			},
			to: {
				type: '*',
			},
		},
	};
