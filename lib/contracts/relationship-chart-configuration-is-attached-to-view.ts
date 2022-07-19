import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipChartConfigurationIsAttachedToView: RelationshipContractDefinition =
	{
		slug: 'relationship-chart-configuration-is-attached-to-view',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached',
			title: 'View',
			inverseTitle: 'Chart Configuration',
			from: {
				type: 'chart-configuration',
			},
			to: {
				type: 'view',
			},
		},
	};
