import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipProjectHasMemberUser: RelationshipContractDefinition =
	{
		slug: 'relationship-project-has-member-user',
		type: 'relationship@1.0.0',
		name: 'has member',
		data: {
			inverseName: 'is member of',
			title: 'Member',
			inverseTitle: 'Member project',
			from: {
				type: 'project',
			},
			to: {
				type: 'user',
			},
		},
	};
