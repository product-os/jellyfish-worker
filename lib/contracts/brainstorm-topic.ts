import {
	ContractDefinition,
	contractMixins as autumndbContractMixins,
} from 'autumndb';
import * as contractMixins from './mixins';

const slug = 'brainstorm-topic';
const type = 'type@1.0.0';
const statusOptions = ['open', 'ongoing', 'closed', 'archived'];

const getFormUiSchema = () => ({
	data: {
		category: {
			'ui:widget': 'AutoCompleteWidget',
			'ui:options': {
				resource: 'brainstorm-topic',
				keyPath: 'data.category',
			},
		},
		reporter: {
			'ui:widget': 'AutoCompleteWidget',
			'ui:options': {
				resource: 'user',
				keyPath: 'slug',
			},
		},
	},
});

export const brainstormTopic: ContractDefinition = contractMixins.mixin(
	contractMixins.withEvents(slug, type),
	contractMixins.asPipelineItem(slug, type, statusOptions),
)({
	slug,
	name: 'Brainstorm Topic',
	type,
	markers: [],
	data: {
		schema: {
			type: 'object',
			required: ['name', 'data'],
			properties: {
				name: {
					type: 'string',
					fullTextSearch: true,
				},
				data: {
					type: 'object',
					required: ['category', 'description'],
					properties: {
						reporter: {
							type: 'string',
							pattern: '^[a-z0-9-]+$',
							fullTextSearch: true,
						},
						category: {
							type: 'string',
							fullTextSearch: true,
						},
						description: {
							type: 'string',
							format: 'markdown',
							fullTextSearch: true,
						},
						flowdockThreadUrl: {
							type: 'string',
							format: 'uri',
							title: 'Flowdock Thread URL',
						},
					},
				},
			},
		},
		uiSchema: {
			snippet: {
				data: {
					'ui:order': ['reporter', 'mentionsUser', 'status', 'category'],
					reporter: {
						...autumndbContractMixins.uiSchemaDef('username'),
						'ui:options': {
							flexDirection: 'row',
						},
					},
					mentionsUser: {
						...autumndbContractMixins.uiSchemaDef('usernameList'),
						'ui:options': {
							flexDirection: 'row',
						},
					},
					status: {
						'ui:title': null,
						'ui:widget': 'Badge',
					},
					category: {
						'ui:title': null,
						'ui:widget': 'HighlightedName',
					},
				},
			},
			fields: {
				data: {
					'ui:order': [
						'reporter',
						'mentionsUser',
						'status',
						'category',
						'description',
						'flowdockThreadUrl',
					],
					category: {
						'ui:widget': 'HighlightedName',
					},
					reporter: autumndbContractMixins.uiSchemaDef('username'),
					flowdockThreadUrl: {
						'ui:options': {
							blank: true,
						},
					},
				},
			},
			edit: getFormUiSchema(),
			create: getFormUiSchema(),
		},
	},
});
