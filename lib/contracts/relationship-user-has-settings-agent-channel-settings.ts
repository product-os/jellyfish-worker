import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipUserHasSettingsAgentChannelSettings: RelationshipContractDefinition =
	{
		slug: 'relationship-user-has-settings-agent-channel-settings',
		type: 'relationship@1.0.0',
		name: 'has settings',
		data: {
			inverseName: 'are settings for',
			title: 'Agent channel settings',
			inverseTitle: 'User',
			from: {
				type: 'user',
			},
			to: {
				type: 'agent-channel-settings',
			},
		},
	};
