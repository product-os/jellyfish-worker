import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipImprovementIsImplementedByProject: RelationshipContractDefinition =
	{
		slug: 'relationship-improvement-is-implemented-by-project',
		type: 'relationship@1.0.0',
		name: 'is implemented by',
		data: {
			inverseName: 'implements',
			title: 'Project',
			inverseTitle: 'Improvement',
			from: {
				type: 'improvement',
			},
			to: {
				type: 'project',
			},
		},
	};
