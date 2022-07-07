import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipAnyWasTransformedToAny: RelationshipContractDefinition =
	{
		slug: 'relationship-any-was-transformed-to-any',
		type: 'relationship@1.0.0',
		name: 'was transformed to',
		data: {
			inverseName: 'was transformed from',
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
