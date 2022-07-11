import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipContractRepositoryContainsAny: RelationshipContractDefinition =
	{
		slug: 'relationship-contract-repository-contains-any',
		type: 'relationship@1.0.0',
		name: 'contains',
		data: {
			inverseName: 'is contained in',
			title: 'Contained Contracts',
			inverseTitle: 'Is contained in Contract Repository',
			from: {
				type: 'contract-repository',
			},
			to: {
				type: '*',
			},
		},
	};
