import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipUserHasSettingsAgentSettings: RelationshipContractDefinition =
	{
		slug: 'relationship-user-has-settings-agent-settings',
		type: 'relationship@1.0.0',
		name: 'has settings',
		data: {
			inverseName: 'are settings for',
			title: 'Agent settings',
			inverseTitle: 'User',
			from: {
				type: 'user',
			},
			to: {
				type: 'agent-settings',
			},
		},
	};
