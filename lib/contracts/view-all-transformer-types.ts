import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

export const viewAllTransformerTypes: ContractDefinition = {
	slug: 'view-all-transformer-types',
	name: 'All Types',
	type: 'view@1.0.0',
	version: '1.0.0',
	markers: ['org-balena'],
	data: {
		namespace: 'Transformers',
		allOf: [
			{
				name: 'All Types for Transformers',
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
									const: 'type@1.0.0',
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
