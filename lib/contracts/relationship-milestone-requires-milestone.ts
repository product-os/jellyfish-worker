import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipMilestoneRequiresMilestone: RelationshipContractDefinition =
	{
		slug: 'relationship-milestone-requires-milestone',
		type: 'relationship@1.0.0',
		name: 'requires',
		data: {
			inverseName: 'is required by',
			title: 'Required milestone',
			inverseTitle: 'Required by milestone',
			from: {
				type: 'milestone',
			},
			to: {
				type: 'milestone',
			},
		},
	};
