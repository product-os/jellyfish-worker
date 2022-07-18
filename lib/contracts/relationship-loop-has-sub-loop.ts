import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipLoopHasSubLoop: RelationshipContractDefinition = {
	slug: 'relationship-loop-has-sub-loop',
	type: 'relationship@1.0.0',
	name: 'has sub-loop',
	data: {
		inverseName: 'is sub-loop of',
		title: 'Sub-Loop',
		inverseTitle: 'Parent Loop',
		from: {
			type: 'loop',
		},
		to: {
			type: 'loop',
		},
	},
};
