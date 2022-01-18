import type { ViewContractDefinition } from '@balena/jellyfish-types/build/core';

export const viewAllViews: ViewContractDefinition = {
	slug: 'view-all-views',
	name: 'All views',
	type: 'view@1.0.0',
	markers: [],
	data: {
		allOf: [
			{
				name: 'Card type view',
				schema: {
					type: 'object',
					anyOf: [
						{
							$$links: {
								'is bookmarked by': {
									type: 'object',
									required: ['type', 'id'],
									properties: {
										type: {
											const: 'user@1.0.0',
										},
										id: {
											const: {
												$eval: 'user.id',
											},
										},
									},
								},
							},
						},
						true,
					],
					properties: {
						type: {
							type: 'string',
							const: 'view@1.0.0',
						},
						active: {
							type: 'boolean',
							const: true,
						},
						data: {
							type: 'object',
							properties: {
								actor: {
									type: 'string',
									description:
										'The actor field is not required, but if it is present it should only match the ID of the current user',
									const: {
										$eval: 'user.id',
									},
								},
							},
						},
					},
					additionalProperties: true,
					required: ['type', 'data'],
				},
			},
		],
	},
};
