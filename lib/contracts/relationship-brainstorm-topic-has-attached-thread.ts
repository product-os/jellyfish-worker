import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipBrainstormTopicHasAttachedThread: RelationshipContractDefinition =
	{
		slug: 'relationship-brainstorm-topic-has-attached-thread',
		type: 'relationship@1.0.0',
		name: 'has attached',
		data: {
			inverseName: 'is attached to',
			title: 'Thread',
			inverseTitle: 'Brainstorm topic',
			from: {
				type: 'brainstorm-topic',
			},
			to: {
				type: 'thread',
			},
		},
	};
