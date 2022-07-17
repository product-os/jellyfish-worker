import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipImprovementIsContributedToByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-improvement-is-contributed-to-by-user',
		type: 'relationship@1.0.0',
		name: 'is contributed to by',
		data: {
			inverseName: 'contributes to',
			title: 'Contributor',
			inverseTitle: 'Improvement contribution',
			from: {
				type: 'improvement',
			},
			to: {
				type: 'user',
			},
		},
	};
