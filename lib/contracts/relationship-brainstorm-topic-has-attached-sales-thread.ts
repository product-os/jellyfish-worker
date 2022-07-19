import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipBrainstormTopicHasAttachedSalesThread: RelationshipContractDefinition =
	{
		slug: 'relationship-brainstorm-topic-has-attached-sales-thread',
		type: 'relationship@1.0.0',
		name: 'has attached',
		data: {
			inverseName: 'is attached to',
			title: 'Sales thread',
			inverseTitle: 'Brainstorm topic',
			from: {
				type: 'brainstorm-topic',
			},
			to: {
				type: 'sales-thread',
			},
		},
	};
