import type { ViewContractDefinition } from 'autumndb';

export const viewAllFaqs: ViewContractDefinition = {
	slug: 'view-all-faqs',
	name: 'FAQs',
	type: 'view@1.0.0',
	markers: ['org-balena'],
	data: {
		allOf: [
			{
				name: 'All FAQs',
				schema: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							const: 'faq@1.0.0',
						},
					},
					additionalProperties: true,
					required: ['type'],
				},
			},
		],
	},
};
