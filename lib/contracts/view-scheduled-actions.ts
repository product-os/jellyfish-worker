import type { ViewContractDefinition } from '@balena/jellyfish-types/build/core';

export const viewScheduledActions: ViewContractDefinition = {
	slug: 'view-scheduled-actions',
	name: 'All scheduled actions',
	type: 'view@1.0.0',
	markers: [],
	data: {
		allOf: [
			{
				name: 'Active scheduled actions view',
				schema: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							const: 'scheduled-action@1.0.0',
						},
						active: {
							type: 'boolean',
							const: true,
						},
					},
					additionalProperties: true,
					required: ['type', 'data'],
				},
			},
		],
	},
};
