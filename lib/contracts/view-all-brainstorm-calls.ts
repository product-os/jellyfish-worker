import type { ViewContractDefinition } from 'autumndb';

export const viewAllBrainstormCalls: ViewContractDefinition = {
	slug: 'view-all-brainstorm-calls',
	name: 'Calls',
	type: 'view@1.0.0',
	markers: ['org-balena'],
	data: {
		namespace: 'Brainstorms',
		allOf: [
			{
				name: 'Active calls',
				schema: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							const: 'brainstorm-call@1.0.0',
						},
						active: {
							type: 'boolean',
							const: true,
						},
					},
					required: ['active', 'type'],
					additionalProperties: true,
				},
			},
		],
	},
};
