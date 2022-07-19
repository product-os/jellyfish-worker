import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipBrainstormTopicHasAttachedImprovement: RelationshipContractDefinition =
	{
		slug: 'relationship-brainstorm-topic-has-attached-improvement',
		type: 'relationship@1.0.0',
		name: 'has attached',
		data: {
			inverseName: 'is attached to',
			title: 'Improvement',
			inverseTitle: 'Brainstorm topic',
			from: {
				type: 'brainstorm-topic',
			},
			to: {
				type: 'improvement',
			},
		},
	};
