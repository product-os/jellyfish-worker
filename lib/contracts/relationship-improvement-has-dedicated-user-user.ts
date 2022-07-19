import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipImprovementHasDedicatedUserUser: RelationshipContractDefinition =
	{
		slug: 'relationship-improvement-has-dedicated-user-user',
		type: 'relationship@1.0.0',
		name: 'has dedicated user',
		data: {
			inverseName: 'is dedicated to',
			title: 'Dedicated user',
			inverseTitle: 'Improvement dedication',
			from: {
				type: 'improvement',
			},
			to: {
				type: 'user',
			},
		},
	};
