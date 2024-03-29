import type { ViewContractDefinition } from 'autumndb';

export const viewMyOpportunities: ViewContractDefinition = {
	slug: 'view-my-opportunities',
	name: 'My opportunities',
	type: 'view@1.0.0',
	markers: ['org-balena'],
	data: {
		namespace: 'Sales',
		allOf: [
			{
				name: 'Active opportunities',
				schema: {
					$$links: {
						'is owned by': {
							type: 'object',
							properties: {
								type: {
									const: 'user@1.0.0',
								},
								id: {
									const: {
										$eval: 'user.id',
									},
								},
							},
						},
					},
					anyOf: [
						{
							$$links: {
								'is attached to': {
									type: 'object',
									properties: {
										type: {
											const: 'account@1.0.0',
										},
									},
									additionalProperties: true,
								},
							},
						},
						true,
					],
					type: 'object',
					properties: {
						active: {
							const: true,
							type: 'boolean',
						},
						type: {
							type: 'string',
							const: 'opportunity@1.0.0',
						},
					},
					required: ['active', 'type'],
					additionalProperties: true,
				},
			},
		],
	},
};
