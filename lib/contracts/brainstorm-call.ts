import { ContractDefinition, contractMixins } from 'autumndb';

export const brainstormCall: ContractDefinition = {
	slug: 'brainstorm-call',
	name: 'Brainstorm Call',
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
						datetime: {
							title: 'Meeting date/time',
							type: 'string',
							format: 'date-time',
						},
					},
					required: ['datetime'],
				},
			},
		},
		uiSchema: {
			snippet: {
				data: {
					datetime: {
						...contractMixins.uiSchemaDef('dateTime'),
						'ui:title': null,
					},
				},
			},
			fields: {
				data: {
					datetime: contractMixins.uiSchemaDef('dateTime'),
				},
			},
		},
		required: ['name', 'data'],
	},
};
