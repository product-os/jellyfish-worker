import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipLoopOwnsTransformer: RelationshipContractDefinition = {
	slug: 'relationship-loop-owns-transformer',
	type: 'relationship@1.0.0',
	name: 'owns',
	data: {
		inverseName: 'is owned by',
		title: 'Owned transformer',
		inverseTitle: 'Loop',
		from: {
			type: 'loop',
		},
		to: {
			type: 'transformer',
		},
	},
};
