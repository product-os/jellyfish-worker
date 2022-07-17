import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipSalesThreadIsAttachedToOpportunity: RelationshipContractDefinition =
	{
		slug: 'relationship-sales-thread-is-attached-to-opportunity',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached',
			title: 'Opportunity',
			inverseTitle: 'Sales thread',
			from: {
				type: 'sales-thread',
			},
			to: {
				type: 'opportunity',
			},
		},
	};
