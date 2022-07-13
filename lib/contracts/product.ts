import type { ContractDefinition } from 'autumndb';

export const product: ContractDefinition = {
	slug: 'product',
	type: 'type@1.0.0',
	name: 'Product',
	markers: [],
	data: {
		schema: {
			type: 'object',
			required: ['name', 'slug'],
			properties: {
				name: {
					type: 'string',
					pattern: '^.*\\S.*$',
					fullTextSearch: true,
				},
				slug: {
					type: 'string',
					pattern: '^product-[a-z0-9-]+$',
				},
				data: {
					type: 'object',
					required: ['url'],
					properties: {
						url: {
							type: 'string',
							format: 'uri',
							fullTextSearch: true,
						},
					},
				},
			},
		},
	},
};
