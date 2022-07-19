import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipGroupHasGroupMemberUser: RelationshipContractDefinition =
	{
		slug: 'relationship-group-has-group-member-user',
		type: 'relationship@1.0.0',
		name: 'has group member',
		data: {
			inverseName: 'is group member of',
			title: 'Member',
			inverseTitle: 'Group',
			from: {
				type: 'group',
			},
			to: {
				type: 'user',
			},
		},
	};
