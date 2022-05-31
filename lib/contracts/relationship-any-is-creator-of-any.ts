import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipAnyIsCreatorOfAny: RelationshipContractDefinition = {
	slug: 'relationship-any-is-creator-of-any',
	type: 'relationship@1.0.0',
	name: 'is creator of',
	data: {
		inverseName: 'was created by',
		title: 'Creator',
		inverseTitle: 'Contract',
		from: {
			type: '*',
		},
		to: {
			type: '*',
		},
	},
};
