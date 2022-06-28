import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipChannelHasAgentUser: RelationshipContractDefinition = {
	slug: 'relationship-channel-has-agent-user',
	type: 'relationship@1.0.0',
	name: 'has agent',
	data: {
		inverseName: 'is agent for',
		title: 'User',
		inverseTitle: 'Channel',
		from: {
			type: 'channel',
		},
		to: {
			type: 'user',
		},
	},
};
