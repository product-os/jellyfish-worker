import type { ContractDefinition } from 'autumndb';

export const notification: ContractDefinition = {
	slug: 'notification',
	type: 'type@1.0.0',
	name: 'Notification',
	markers: [],
	data: {
		schema: {
			type: 'object',
			properties: {
				data: {
					type: 'object',
					properties: {
						status: {
							type: 'string',
							enum: ['open', 'archived'],
						},
					},
				},
			},
		},
		indexed_fields: [['data.status']],
	},
};
