import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipUserHasSettingsWorkingHours: RelationshipContractDefinition =
	{
		slug: 'relationship-user-has-settings-working-hours',
		type: 'relationship@1.0.0',
		name: 'has settings',
		data: {
			inverseName: 'are settings for',
			title: 'Working hours',
			inverseTitle: 'User',
			from: {
				type: 'user',
			},
			to: {
				type: 'working-hours',
			},
		},
	};
