import type { ContractDefinition } from 'autumndb';

export const tag: ContractDefinition = {
	slug: 'tag',
	type: 'type@1.0.0',
	name: 'Tag',
	markers: [],
	data: {
		schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
				},
				data: {
					type: 'object',
					properties: {
						count: {
							type: 'number',
						},
						color: {
							type: 'string',
						},
						description: {
							type: 'string',
						},
					},
				},
			},
		},
	},
};
