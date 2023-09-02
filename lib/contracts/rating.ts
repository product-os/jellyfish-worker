import { ContractDefinition, contractMixins } from 'autumndb';

const getFormUiSchema = () => ({
	data: {
		payload: {
			score: {
				'ui:widget': 'Rating',
			},
		},
	},
});

export const rating: ContractDefinition = {
	slug: 'rating',
	type: 'type@1.0.0',
	name: 'Rating',
	markers: [],
	data: {
		schema: {
			type: 'object',
			required: ['version', 'data'],
			properties: {
				version: {
					title: 'Version',
					type: 'string',
					const: '1.0.0',
				},
				data: {
					type: 'object',
					properties: {
						timestamp: {
							title: 'Timestamp',
							type: 'string',
							format: 'date-time',
							fullTextSearch: true,
						},
						actor: {
							title: 'Actor',
							type: 'string',
							format: 'uuid',
						},
						payload: {
							type: 'object',
							properties: {
								mentionsUser: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								alertsUser: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								mentionsGroup: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								alertsGroup: {
									type: 'array',
									items: {
										type: 'string',
									},
								},
								message: {
									title: 'Message',
									type: 'string',
									$$formula:
										'(contract.data.payload.score ? "Review score: " + contract.data.payload.score + "/5" : "") +' +
										'(contract.data.payload.comment ? "\\n\\nReview comment:\\n" + contract.data.payload.comment : "")',
									readOnly: true,
								},
								comment: {
									title: 'Comment',
									type: 'string',
									format: 'markdown',
									fullTextSearch: true,
								},
								score: {
									title: 'Score',
									type: 'number',
								},
							},
						},
						edited_at: {
							title: 'Edited at',
							type: 'string',
							format: 'date-time',
						},
						readBy: {
							title: 'Users that have seen this rating',
							type: 'array',
							items: {
								type: 'string',
							},
						},
					},
					required: ['timestamp', 'actor', 'payload'],
				},
			},
		},
		uiSchema: {
			fields: {
				data: {
					actor: contractMixins.uiSchemaDef('idOrSlugLink'),
					target: contractMixins.uiSchemaDef('idOrSlugLink'),
					mirrors: contractMixins.uiSchemaDef('mirrors'),
					timestamp: contractMixins.uiSchemaDef('dateTime'),
					edited_at: contractMixins.uiSchemaDef('dateTime'),
					readBy: contractMixins.uiSchemaDef('usernameList'),
					payload: {
						'ui:title': null,
						mentionsUser: contractMixins.uiSchemaDef('usernameList'),
						alertsUser: contractMixins.uiSchemaDef('usernameList'),
						mentionsGroup: contractMixins.uiSchemaDef('groupList'),
						alertsGroup: contractMixins.uiSchemaDef('groupList'),
						comment: {
							'ui:widget': 'textarea',
							'ui:options': {
								rows: 2,
							},
						},
					},
				},
			},
			edit: getFormUiSchema(),
			create: getFormUiSchema(),
		},
		indexed_fields: [
			['data.readBy'],
			['data.payload.mentionsUser'],
			['data.payload.alertsUser'],
			['data.payload.mentionsGroup'],
			['data.payload.alertsGroup'],
			['data.actor'],
		],
	},
};
