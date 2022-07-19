import type { ViewContractDefinition } from 'autumndb';

export const viewAllCustomers: ViewContractDefinition = {
	slug: 'view-all-customers',
	name: 'All accounts',
	type: 'view@1.0.0',
	markers: ['org-balena'],
	data: {
		namespace: 'Sales',
		allOf: [
			{
				name: 'Active cards',
				schema: {
					type: 'object',
					properties: {
						active: {
							const: true,
							type: 'boolean',
						},
						type: {
							type: 'string',
							const: 'account@1.0.0',
						},
					},
					required: ['active', 'type'],
					additionalProperties: true,
				},
			},
		],
	},
};
