import { ContractDefinition, contractMixins } from 'autumndb';

export const message: ContractDefinition = {
	slug: 'message',
	type: 'type@1.0.0',
	name: 'Chat message',
	markers: [],
	data: {
		schema: {
			type: 'object',
			required: ['version', 'data'],
			properties: {
				version: {
					type: 'string',
					const: '1.0.0',
				},
				data: {
					type: 'object',
					properties: {
						timestamp: {
							type: 'string',
							format: 'date-time',
							fullTextSearch: true,
						},
						actor: {
							type: 'string',
							format: 'uuid',
						},
						payload: {
							type: 'object',
							required: ['message'],
							properties: {
								reactions: {
									type: 'object',
									$$formula:
										'contract.links["has attached element"] && contract.links["has attached element"].length ? (COUNT_BY(FILTER(contract.links["has attached element"], { type: "reaction@1.0.0" }), "data.reaction")) : {}',
								},
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
								file: {
									type: 'object',
									properties: {
										name: {
											type: 'string',
											fullTextSearch: true,
										},
										mime: {
											type: 'string',
										},
										bytesize: {
											type: 'number',
										},
										slug: {
											type: 'string',
										},
									},
								},
								attachments: {
									type: 'array',
									items: {
										type: 'object',
										required: ['url', 'name', 'mime', 'bytesize'],
										properties: {
											url: {
												type: 'string',
											},
											name: {
												type: 'string',
											},
											mime: {
												type: 'string',
											},
											bytesize: {
												type: 'number',
											},
										},
									},
								},
								message: {
									type: 'string',
									format: 'markdown',
									fullTextSearch: true,
								},
							},
						},
						edited_at: {
							type: 'string',
							format: 'date-time',
						},
						readBy: {
							description: 'Users that have seen this message',
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
						attachments: {
							items: {
								url: {
									'ui:widget': 'Link',
								},
							},
						},
					},
				},
			},
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
