import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipMilestoneIsOwnedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-milestone-is-owned-by-user',
		type: 'relationship@1.0.0',
		name: 'is owned by',
		data: {
			inverseName: 'owns',
			title: 'Owner',
			inverseTitle: 'Owned milestone',
			from: {
				type: 'milestone',
			},
			to: {
				type: 'user',
			},
		},
	};
