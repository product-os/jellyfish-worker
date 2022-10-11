import type { RoleContractDefinition } from 'autumndb';

export const roleUserExternalSupport: RoleContractDefinition = {
	slug: 'role-user-external-support',
	name: 'External support user role permissions',
	type: 'role@1.0.0',
	markers: [],
	data: {
		read: {
			type: 'object',
			required: ['active'],
			properties: {
				active: {
					type: 'boolean',
					const: true,
				},
			},
			anyOf: [
				{
					type: 'object',
					additionalProperties: true,
					required: ['type'],
					properties: {
						type: {
							type: 'string',
							enum: ['link@1.0.0', 'subscription@1.0.0', 'relationship@1.0.0'],
						},
					},
				},
				{
					type: 'object',
					additionalProperties: true,
					required: ['type', 'markers'],
					properties: {
						type: {
							type: 'string',
							const: 'notification@1.0.0',
						},
						markers: {
							type: 'array',
							contains: {
								const: {
									$eval: 'user.slug',
								},
							},
							maxItems: 1,
							minItems: 1,
						},
					},
				},
				{
					type: 'object',
					additionalProperties: true,
					required: ['type', 'markers'],
					properties: {
						type: {
							type: 'string',
							enum: ['create@1.0.0', 'message@1.0.0'],
						},
						markers: {
							type: 'array',
							contains: {
								enum: [
									{
										$eval: "user.slug + '+org-balena'",
									},
									{
										$eval: 'user.slug',
									},
								],
							},
							maxItems: 1,
							minItems: 1,
						},
					},
				},
				{
					type: 'object',
					additionalProperties: true,
					required: ['type', 'markers', 'data'],
					properties: {
						type: {
							type: 'string',
							const: 'support-thread@1.0.0',
						},
						markers: {
							type: 'array',
							contains: {
								const: {
									$eval: "user.slug + '+org-balena'",
								},
							},
							maxItems: 1,
							minItems: 1,
						},
						data: {
							type: 'object',
							additionalProperties: true,
							required: ['product', 'inbox'],
							properties: {
								product: {
									type: 'string',
									const: 'balenaCloud',
								},
								inbox: {
									type: 'string',
								},
							},
						},
					},
				},
				{
					type: 'object',
					required: ['slug', 'type', 'data'],
					properties: {
						slug: {
							type: 'string',
							enum: [
								'card',
								'link',
								'message',
								'support-thread',
								'notification',
								'subscription',
								'create',
								'update',
								'view',
							],
						},
						type: {
							type: 'string',
							const: 'type@1.0.0',
						},
						data: {
							type: 'object',
							additionalProperties: true,
						},
					},
				},
				{
					type: 'object',
					required: ['id', 'slug', 'type', 'data'],
					properties: {
						id: {
							type: 'string',
						},
						slug: {
							type: 'string',
							enum: [
								'action-create-session',
								'action-create-card',
								'action-update-card',
								'action-create-event',
								'action-oauth-associate',
								'action-integration-discourse-mirror-event',
								'action-integration-front-mirror-event',
								'action-integration-github-mirror-event',
							],
						},
						type: {
							type: 'string',
							const: 'action@1.0.0',
						},
						data: {
							type: 'object',
							additionalProperties: true,
						},
					},
				},
				{
					type: 'object',
					required: ['id', 'slug', 'type', 'data'],
					properties: {
						id: {
							type: 'string',
						},
						slug: {
							type: 'string',
							enum: ['view-all-views'],
						},
						type: {
							type: 'string',
							const: 'view@1.0.0',
						},
						data: {
							type: 'object',
							additionalProperties: true,
						},
					},
				},
				{
					type: 'object',
					required: ['type', 'data'],
					additionalProperties: true,
					properties: {
						type: {
							type: 'string',
							enum: [
								'execute@1.0.0',
								'session@1.0.0',
								'create@1.0.0',
								'update@1.0.0',
							],
						},
						data: {
							type: 'object',
							additionalProperties: true,
							required: ['actor'],
							properties: {
								actor: {
									type: 'string',
									const: {
										$eval: 'user.id',
									},
								},
							},
						},
					},
				},
				{
					type: 'object',
					additionalProperties: true,
					required: ['id', 'slug', 'type', 'data'],
					properties: {
						slug: {
							type: 'string',
							const: {
								$eval: 'user.slug',
							},
						},
						type: {
							type: 'string',
							const: 'user@1.0.0',
						},
						data: {
							type: 'object',
							additionalProperties: false,
							properties: {
								email: {
									type: ['string', 'array'],
								},
								avatar: {
									type: ['string', 'null'],
								},
								oauth: {
									type: 'object',
									additionalProperties: true,
								},
								profile: {
									type: 'object',
									additionalProperties: true,
								},
							},
						},
					},
				},
				{
					type: 'object',
					additionalProperties: true,
					required: ['id', 'slug', 'type', 'data'],
					properties: {
						type: {
							type: 'string',
							const: 'user@1.0.0',
						},
						data: {
							type: 'object',
							additionalProperties: false,
							properties: {
								email: {
									type: ['string', 'array'],
								},
								avatar: {
									type: ['string', 'null'],
								},
								profile: {
									type: 'object',
									additionalProperties: true,
								},
							},
						},
					},
				},
				{
					properties: {
						type: {
							enum: [
								'authentication-oauth@1.0.0',
								'authentication-password@1.0.0',
							],
						},
						data: {
							type: 'object',
							required: ['actorId'],
							properties: {
								actorId: {
									const: {
										$eval: 'user.id',
									},
								},
							},
						},
					},
				},
				{
					type: 'object',
					required: ['type', 'slug'],
					properties: {
						type: {
							type: 'string',
							const: 'org@1.0.0',
						},
						slug: {
							type: 'string',
							const: 'org-balena',
						},
					},
				},
			],
		},
	},
};
