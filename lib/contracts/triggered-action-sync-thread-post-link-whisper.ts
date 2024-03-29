import type { TriggeredActionContractDefinition } from '../types';

export const triggeredActionSyncThreadPostLinkWhisper: TriggeredActionContractDefinition =
	{
		slug: 'triggered-action-sync-thread-post-link-whisper',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for creating a whisper with link on thread sync',
		markers: [],
		data: {
			filter: {
				title: "Support threads created with a 'mirrors' field",
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								const: 'support-thread@1.0.0',
							},
							id: {
								type: 'string',
							},
						},
					},
				},
				type: 'object',
				required: ['active', 'type', 'data'],
				properties: {
					active: {
						type: 'boolean',
						const: true,
					},
					type: {
						type: 'string',
						const: 'create@1.0.0',
					},
					data: {
						type: 'object',
						required: ['payload'],
						properties: {
							payload: {
								type: 'object',
								required: ['type', 'data'],
								properties: {
									type: {
										type: 'string',
										const: 'support-thread@1.0.0',
									},
									data: {
										type: 'object',
										required: ['mirrors'],
										properties: {
											mirrors: {
												description:
													"The 'mirrors' field indicates the thread is sync to an external resource",
												type: 'array',
												minItems: 1,
											},
										},
									},
								},
							},
						},
					},
				},
			},
			action: 'action-create-event@1.0.0',
			target: {
				$eval: "source.links['is attached to'][0].id",
			},
			arguments: {
				payload: {
					message:
						"[This thread is synced to Jellyfish](https://jel.ly.fish/${source.links['is attached to'][0].id})",
				},
				type: 'whisper',
			},
		},
	};
