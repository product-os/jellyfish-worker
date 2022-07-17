import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipBrainstormTopicHasAttachedSupportThread: RelationshipContractDefinition =
	{
		slug: 'relationship-brainstorm-topic-has-attached-support-thread',
		type: 'relationship@1.0.0',
		name: 'has attached',
		data: {
			inverseName: 'is attached to',
			title: 'Support thread',
			inverseTitle: 'Brainstorm topic',
			from: {
				type: 'brainstorm-topic',
			},
			to: {
				type: 'support-thread',
			},
		},
	};
