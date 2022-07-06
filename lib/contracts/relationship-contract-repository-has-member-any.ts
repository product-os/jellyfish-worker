import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipContractRepositoryHasMemberAny: RelationshipContractDefinition =
	{
		slug: 'relationship-contract-repository-has-member-any',
		type: 'relationship@1.0.0',
		name: 'has member',
		data: {
			inverseName: 'is member of',
			title: 'Member',
			inverseTitle: 'Contract Repository',
			from: {
				type: 'contract-repository',
			},
			to: {
				type: '*',
			},
		},
	};
