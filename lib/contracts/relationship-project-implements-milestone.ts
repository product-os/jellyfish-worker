import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipProjectImplementsMilestone: RelationshipContractDefinition =
	{
		slug: 'relationship-project-implements-milestone',
		type: 'relationship@1.0.0',
		name: 'implements',
		data: {
			inverseName: 'is implemented by',
			title: 'Milestone',
			inverseTitle: 'Project',
			from: {
				type: 'project',
			},
			to: {
				type: 'milestone',
			},
		},
	};
