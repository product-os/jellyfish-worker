import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipUserHasSettingsWorkingHoursOverride: RelationshipContractDefinition =
	{
		slug: 'relationship-user-has-settings-working-hours-override',
		type: 'relationship@1.0.0',
		name: 'has settings',
		data: {
			inverseName: 'are settings for',
			title: 'Working hours override',
			inverseTitle: 'User',
			from: {
				type: 'user',
			},
			to: {
				type: 'working-hours-override',
			},
		},
	};
