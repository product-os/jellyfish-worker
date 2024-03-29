import type { ContractDefinition } from 'autumndb';

export const summary: ContractDefinition = {
	slug: 'summary',
	type: 'type@1.0.0',
	name: 'Summary',
	markers: [],
	data: {
		schema: {
			type: 'object',
			required: ['version', 'data'],
			properties: {
				version: {
					type: 'string',
					const: '1.0.0',
				},
				data: {
					type: 'object',
					properties: {
						timestamp: {
							type: 'string',
							format: 'date-time',
							fullTextSearch: true,
						},
						actor: {
							type: 'string',
							format: 'uuid',
						},
						payload: {
							type: 'object',
							required: ['message'],
							properties: {
								mentionsUser: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								alertsUser: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								mentionsGroup: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								alertsGroup: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								message: {
									type: 'string',
									format: 'markdown',
									fullTextSearch: true,
								},
							},
						},
						readBy: {
							description: 'Users that have seen this summary',
							type: 'array',
							items: {
								type: 'string',
							},
						},
					},
					required: ['timestamp', 'actor', 'payload'],
				},
			},
		},
		indexed_fields: [
			['data.readBy'],
			['data.payload.mentionsUser'],
			['data.payload.alertsUser'],
			['data.payload.mentionsGroup'],
			['data.payload.alertsGroup'],
			['data.actor'],
		],
	},
};
