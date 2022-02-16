import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { contractMixins } from 'autumndb';

export const contact: ContractDefinition = {
	slug: 'contact',
	type: 'type@1.0.0',
	name: 'Contact',
	markers: [],
	data: {
		schema: {
			type: 'object',
			properties: {
				markers: {
					type: 'array',
					items: {
						type: 'string',
						pattern: '^[a-zA-Z0-9-_/:+]+$',
					},
				},
				name: {
					type: ['string', 'null'],
					fullTextSearch: true,
				},
				slug: {
					type: 'string',
					pattern: '^contact-[a-z0-9-]+$',
				},
				data: {
					type: 'object',
					properties: {
						source: {
							type: 'string',
						},
						profile: {
							type: 'object',
							properties: {
								email: {
									anyOf: [
										{
											title: 'string',
											type: 'string',
											format: 'email',
										},
										{
											title: 'array',
											type: 'array',
											uniqueItems: true,
											minItems: 1,
											items: {
												type: 'string',
												format: 'email',
											},
										},
									],
								},
								company: {
									type: 'string',
								},
								title: {
									type: 'string',
								},
								type: {
									type: 'string',
								},
								country: {
									type: 'string',
								},
								city: {
									type: 'string',
								},
								name: {
									type: 'object',
									properties: {
										first: {
											type: 'string',
										},
										last: {
											type: 'string',
										},
									},
								},
							},
						},
					},
				},
			},
			required: ['data'],
		},
		uiSchema: {
			fields: {
				data: {
					mirrors: null,
					profile: {
						'ui:title': null,
						email: contractMixins.uiSchemaDef('email'),
						name: {
							'ui:title': null,
							'ui:order': ['first', 'last'],
							first: {
								'ui:title': 'First name',
							},
							last: {
								'ui:title': 'Last name',
							},
						},
					},
				},
			},
			snippet: {
				data: {
					profile: {
						'ui:explicit': true,
						'ui:title': null,
						'ui:order': ['type', 'company', 'email'],
						email: {
							...contractMixins.uiSchemaDef('email'),
							'ui:options': {
								flexDirection: 'row',
							},
						},
						type: {
							'ui:options': {
								italic: true,
								flexDirection: 'row',
							},
						},
						company: {
							'ui:options': {
								italic: true,
								flexDirection: 'row',
							},
						},
					},
				},
			},
		},
		meta: {
			relationships: [
				{
					title: 'Support',
					query: [
						{
							link: 'is attached to user',
							type: 'user',
						},
						{
							$$links: {
								'has attached element': {
									type: 'object',
									properties: {
										type: {
											const: 'create@1.0.0',
										},
										data: {
											type: 'object',
											properties: {
												actor: {
													const: {
														$eval: 'result.id',
													},
												},
											},
											required: ['actor'],
										},
									},
									required: ['data'],
								},
							},
							type: 'object',
							properties: {
								type: {
									const: 'support-thread@1.0.0',
								},
							},
						},
					],
				},
			],
		},
	},
};
