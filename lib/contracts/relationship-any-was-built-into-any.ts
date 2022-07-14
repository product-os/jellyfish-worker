import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipAnyWasBuiltIntoAny: RelationshipContractDefinition = {
	slug: 'relationship-any-was-built-into-any',
	type: 'relationship@1.0.0',
	name: 'was built into',
	data: {
		inverseName: 'was built from',
		title: 'Transformation output',
		inverseTitle: 'Transformation input',
		from: {
			type: '*',
		},
		to: {
			type: '*',
		},
	},
};
