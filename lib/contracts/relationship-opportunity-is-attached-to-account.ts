import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipOpportunityIsAttachedToAccount: RelationshipContractDefinition =
	{
		slug: 'relationship-opportunity-is-attached-to-account',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached',
			title: 'Account',
			inverseTitle: 'Opportunity',
			from: {
				type: 'opportunity',
			},
			to: {
				type: 'account',
			},
		},
	};
