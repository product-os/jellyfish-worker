import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipLoopHasThread: RelationshipContractDefinition = {
	slug: 'relationship-loop-has-thread',
	type: 'relationship@1.0.0',
	name: 'has',
	data: {
		inverseName: 'is of',
		title: 'Thread',
		inverseTitle: 'Loop',
		from: {
			type: 'loop',
		},
		to: {
			type: 'thread',
		},
	},
};
