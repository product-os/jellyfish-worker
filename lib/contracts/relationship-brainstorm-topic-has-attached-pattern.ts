import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipBrainstormTopicHasAttachedPattern: RelationshipContractDefinition =
	{
		slug: 'relationship-brainstorm-topic-has-attached-pattern',
		type: 'relationship@1.0.0',
		name: 'has attached',
		data: {
			inverseName: 'is attached to',
			title: 'Pattern',
			inverseTitle: 'Brainstorm topic',
			from: {
				type: 'brainstorm-topic',
			},
			to: {
				type: 'pattern',
			},
		},
	};
