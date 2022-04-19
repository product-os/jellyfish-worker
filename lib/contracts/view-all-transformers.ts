import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

export const viewAllTransformers: ContractDefinition = {
	slug: 'view-all-transformers',
	version: '1.0.0',
	name: 'All transformers',
	type: 'view@1.0.0',
	markers: ['org-balena'],
	data: {
		namespace: 'Transformers',
		allOf: [
			{
				name: 'All transformers',
				schema: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							const: 'contract-repository@1.0.0',
						},
						data: {
							type: 'object',
							required: ['base_type'],
							properties: {
								base_type: {
									type: 'string',
									const: 'transformer@1.0.0',
								},
							},
						},
					},
					additionalProperties: true,
					required: ['type'],
				},
			},
		],
	},
};
