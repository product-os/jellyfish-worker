import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipPatternIsAttachedToSupportThread: RelationshipContractDefinition =
	{
		slug: 'relationship-pattern-is-attached-to-support-thread',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached',
			title: 'Support thread',
			inverseTitle: 'Pattern',
			from: {
				type: 'pattern',
			},
			to: {
				type: 'support-thread',
			},
		},
	};
