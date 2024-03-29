import type { ViewContractDefinition } from 'autumndb';

export const viewActiveTriggeredActions: ViewContractDefinition = {
	slug: 'view-active-triggered-actions',
	name: 'Active Triggered Actions',
	type: 'view@1.0.0',
	markers: [],
	data: {
		allOf: [
			{
				name: 'Triggered actions',
				schema: {
					type: 'object',
					properties: {
						active: {
							type: 'boolean',
							const: true,
						},
						type: {
							type: 'string',
							const: 'triggered-action@1.0.0',
						},
						data: {
							type: 'object',
							additionalProperties: true,
						},
					},
					required: ['active', 'type', 'data'],
				},
			},
		],
	},
};
