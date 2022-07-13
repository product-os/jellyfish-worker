import type { ContractDefinition } from 'autumndb';

export const chartConfiguration: ContractDefinition = {
	slug: 'chart-configuration',
	name: 'Chart configuration',
	type: 'type@1.0.0',
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
						description: {
							type: 'string',
						},
						chartingLibrary: {
							title: 'Charting library',
							type: 'string',
							enum: ['plotly'],
							default: 'plotly',
						},
						settings: {
							type: 'string',
							format: 'markdown',
						},
					},
					required: ['chartingLibrary', 'settings'],
				},
			},
			required: ['name', 'data'],
		},
		uiSchema: {
			fields: {
				data: {
					settings: {
						'ui:value': '```json\n${source}\n```',
					},
				},
			},
		},
		indexed_fields: [['data.chartingLibrary']],
	},
};
