import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipBrainstormCallHasAttachedBrainstormTopic: RelationshipContractDefinition =
	{
		slug: 'relationship-brainstorm-call-has-attached-brainstorm-topic',
		type: 'relationship@1.0.0',
		name: 'has attached',
		data: {
			inverseName: 'is attached to',
			title: 'Brainstorm topic',
			inverseTitle: 'Brainstorm call',
			from: {
				type: 'brainstorm-call',
			},
			to: {
				type: 'brainstorm-topic',
			},
		},
	};
