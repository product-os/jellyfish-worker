import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipLoopHasChannel: RelationshipContractDefinition = {
	slug: 'relationship-loop-has-channel',
	type: 'relationship@1.0.0',
	name: 'has',
	data: {
		inverseName: 'is of',
		title: 'Channel',
		inverseTitle: 'Loop',
		from: {
			type: 'loop',
		},
		to: {
			type: 'channel',
		},
	},
};
