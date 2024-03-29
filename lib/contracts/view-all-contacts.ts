import type { ViewContractDefinition } from 'autumndb';

export const viewAllContacts: ViewContractDefinition = {
	slug: 'view-all-contacts',
	name: 'All contacts',
	type: 'view@1.0.0',
	markers: ['org-balena'],
	data: {
		namespace: 'Sales',
		allOf: [
			{
				name: 'Active contacts',
				schema: {
					type: 'object',
					properties: {
						active: {
							const: true,
							type: 'boolean',
						},
						type: {
							type: 'string',
							const: 'contact@1.0.0',
						},
					},
					required: ['active', 'type'],
					additionalProperties: true,
				},
			},
		],
	},
};
