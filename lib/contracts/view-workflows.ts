import type { ViewContractDefinition } from 'autumndb';

export const viewWorkflows: ViewContractDefinition = {
	slug: 'view-workflows',
	name: 'Workflows',
	type: 'view@1.0.0',
	markers: ['org-balena'],
	data: {
		allOf: [
			{
				name: 'Workflows',
				schema: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							const: 'workflow@1.0.0',
						},
					},
					additionalProperties: true,
					required: ['type'],
				},
			},
		],
	},
};
