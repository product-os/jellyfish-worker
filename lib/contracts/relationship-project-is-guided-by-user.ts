import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipProjectIsGuidedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-project-is-guided-by-user',
		type: 'relationship@1.0.0',
		name: 'is guided by',
		data: {
			inverseName: 'guides',
			title: 'Guide',
			inverseTitle: 'Guided project',
			from: {
				type: 'project',
			},
			to: {
				type: 'user',
			},
		},
	};
