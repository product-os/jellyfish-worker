import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipThreadIsOfAny: RelationshipContractDefinition = {
	slug: 'relationship-thread-is-of-any',
	type: 'relationship@1.0.0',
	name: 'is of',
	data: {
		inverseName: 'has',
		title: 'Thread',
		inverseTitle: 'Contract',
		from: {
			type: 'thread',
		},
		to: {
			type: '*',
		},
	},
};
