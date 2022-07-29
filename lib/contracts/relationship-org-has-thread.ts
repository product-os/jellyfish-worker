import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipOrgHasThread: RelationshipContractDefinition = {
	slug: 'relationship-org-has-thread',
	type: 'relationship@1.0.0',
	name: 'has',
	data: {
		inverseName: 'is of',
		title: 'Thread',
		inverseTitle: 'Org',
		from: {
			type: 'org',
		},
		to: {
			type: 'thread',
		},
	},
};
