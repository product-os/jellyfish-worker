import type { ContractDefinition } from 'autumndb';

export const reaction: ContractDefinition = {
	slug: 'reaction',
	type: 'type@1.0.0',
	name: 'Reaction',
	data: {
		schema: {
			type: 'object',
			required: ['slug', 'type', 'data'],
			properties: {
				slug: {
					type: 'string',
					pattern: '^reaction-[a-z0-9-]+$',
				},
				type: {
					type: 'string',
					const: 'reaction@1.0.0',
				},
				data: {
					type: 'object',
					properties: {
						reaction: {
							type: 'string',
							pattern: '^:[a-z_+0-9-]+:$',
						},
					},
					required: ['reaction'],
				},
			},
		},
	},
};
