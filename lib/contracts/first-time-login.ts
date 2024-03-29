import type { ContractDefinition } from 'autumndb';

export const firstTimeLogin: ContractDefinition = {
	slug: 'first-time-login',
	name: 'first-time login',
	type: 'type@1.0.0',
	markers: [],
	data: {
		schema: {
			type: 'object',
			properties: {
				data: {
					type: 'object',
					properties: {
						requestedAt: {
							type: 'string',
							format: 'date-time',
						},
						expiresAt: {
							type: 'string',
							format: 'date-time',
						},
						firstTimeLoginToken: {
							type: 'string',
							format: 'uuid',
						},
					},
				},
			},
		},
	},
};
