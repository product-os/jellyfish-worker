import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipPatternRelatesToPattern: RelationshipContractDefinition =
	{
		slug: 'relationship-pattern-relates-to-pattern',
		type: 'relationship@1.0.0',
		name: 'relates to',
		data: {
			inverseName: 'relates to',
			title: 'Related pattern',
			inverseTitle: 'Related pattern',
			from: {
				type: 'pattern',
			},
			to: {
				type: 'pattern',
			},
		},
	};
