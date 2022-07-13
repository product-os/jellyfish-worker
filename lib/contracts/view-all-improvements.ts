import type { ViewContractDefinition } from 'autumndb';

export const viewAllImprovements: ViewContractDefinition = {
	slug: 'view-all-improvements',
	name: 'Improvements',
	type: 'view@1.0.0',
	markers: ['org-balena'],
	data: {
		allOf: [
			{
				name: 'All Improvements',
				schema: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							const: 'improvement@1.0.0',
						},
					},
					additionalProperties: true,
					required: ['type'],
					anyOf: [
						{
							$$links: {
								'is owned by': {
									type: 'object',
									required: ['type'],
									properties: {
										type: {
											const: 'user@1.0.0',
										},
									},
								},
							},
						},
						true,
					],
				},
			},
		],
	},
};
