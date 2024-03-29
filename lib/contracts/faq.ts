import type { ContractDefinition } from 'autumndb';

export const faq: ContractDefinition = {
	slug: 'faq',
	name: 'F.A.Q',
	type: 'type@1.0.0',
	markers: [],
	data: {
		schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					fullTextSearch: true,
				},
				data: {
					type: 'object',
					properties: {
						topic: {
							type: 'string',
							fullTextSearch: true,
						},
						answer: {
							type: 'string',
							format: 'markdown',
							fullTextSearch: true,
						},
					},
				},
			},
			required: ['name', 'data'],
		},
		uiSchema: {
			fields: {
				data: {
					topic: {
						'ui:title': null,
						'ui:widget': 'HighlightedName',
					},
					answer: {
						'ui:title': null,
					},
				},
			},
		},
	},
};
