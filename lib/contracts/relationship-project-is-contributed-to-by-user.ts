import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipProjectIsContributedToByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-project-is-contributed-to-by-user',
		type: 'relationship@1.0.0',
		name: 'is contributed to by',
		data: {
			inverseName: 'contributes to',
			title: 'Contributor',
			inverseTitle: 'Project contribution',
			from: {
				type: 'project',
			},
			to: {
				type: 'user',
			},
		},
	};
