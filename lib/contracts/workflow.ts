import type { ContractDefinition } from 'autumndb';
import * as contractMixins from './mixins';

const slug = 'workflow';
const type = 'type@1.0.0';
const statusOptions = ['draft', 'candidate', 'complete'];
const statusNames = ['Draft', 'Candidate', 'Complete'];

export const workflow: ContractDefinition = contractMixins.mixin(
	contractMixins.withEvents(slug, type),
	contractMixins.asPipelineItem(
		slug,
		type,
		statusOptions,
		statusOptions[0],
		statusNames,
	),
)({
	slug,
	type,
	name: 'Workflow',
	data: {
		schema: {
			type: 'object',
			properties: {
				name: {
					type: ['string', 'null'],
					fullTextSearch: true,
				},
				data: {
					type: 'object',
					properties: {
						lifecycle: {
							type: 'string',
						},
						description: {
							type: 'string',
							format: 'markdown',
						},
						diagram: {
							type: 'string',
							format: 'mermaid',
						},
					},
				},
			},
		},
		uiSchema: {
			fields: {
				'ui:options': {
					alignSelf: 'stretch',
				},
				data: {
					diagram: {
						'ui:options': {
							alignSelf: 'stretch',
						},
					},
				},
			},
			edit: {
				$ref: '#/data/uiSchema/definitions/form',
			},
			create: {
				$ref: '#/data/uiSchema/edit',
			},
			definitions: {
				form: {
					data: {
						lifecycle: {
							'ui:widget': 'AutoCompleteWidget',
							'ui:options': {
								resource: 'workflow',
								keyPath: 'data.lifecycle',
							},
						},
					},
				},
			},
		},
	},
});
