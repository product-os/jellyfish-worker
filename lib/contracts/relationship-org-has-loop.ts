import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipOrgHasLoop: RelationshipContractDefinition = {
	slug: 'relationship-org-has-loop',
	type: 'relationship@1.0.0',
	name: 'has',
	data: {
		inverseName: 'belongs to',
		title: 'Loop',
		inverseTitle: 'Org',
		from: {
			type: 'Org',
		},
		to: {
			type: 'Loop',
		},
	},
};
