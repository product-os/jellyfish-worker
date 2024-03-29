import type { ContractDefinition } from 'autumndb';

export const webPushSubscription: ContractDefinition = {
	slug: 'web-push-subscription',
	type: 'type@1.0.0',
	name: 'Web Push subscription',
	markers: [],
	data: {
		schema: {
			type: 'object',
			required: ['data'],
			properties: {
				data: {
					type: 'object',
					required: ['endpoint', 'token', 'auth'],
					properties: {
						endpoint: {
							type: 'string',
						},
						token: {
							type: 'string',
						},
						auth: {
							type: 'string',
						},
					},
				},
			},
		},
		indexed_fields: [['data.endpoint']],
	},
};
