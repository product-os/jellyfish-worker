import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipImprovementIsGuidedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-improvement-is-guided-by-user',
		type: 'relationship@1.0.0',
		name: 'is guided by',
		data: {
			inverseName: 'guides',
			title: 'Guide',
			inverseTitle: 'Guided improvement',
			from: {
				type: 'improvement',
			},
			to: {
				type: 'user',
			},
		},
	};
