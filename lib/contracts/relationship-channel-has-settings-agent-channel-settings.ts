import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipChannelHasSettingsAgentChannelSettings: RelationshipContractDefinition =
	{
		slug: 'relationship-channel-has-settings-agent-channel-settings',
		type: 'relationship@1.0.0',
		name: 'has settings',
		data: {
			inverseName: 'are settings for',
			title: 'Agent channel settings',
			inverseTitle: 'Channel',
			from: {
				type: 'channel',
			},
			to: {
				type: 'agent-channel-settings',
			},
		},
	};
