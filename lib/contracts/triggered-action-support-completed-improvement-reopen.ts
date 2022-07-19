import type { TriggeredActionContractDefinition } from '../types';

const IMPROVEMENT_COMPLETE_STATUS = 'completed';

export const triggeredActionSupportCompletedImprovementReopen: TriggeredActionContractDefinition =
	{
		slug: 'triggered-action-support-completed-improvement-reopen',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for reopening support threads when improvements are completed',
		markers: [],
		data: {
			filter: {
				$$links: {
					'is attached to': {
						$$links: {
							'is attached to': {
								type: 'object',
								required: ['type', 'data'],
								properties: {
									type: {
										type: 'string',
										const: 'support-thread@1.0.0',
									},
									data: {
										type: 'object',
										required: ['status'],
										properties: {
											status: {
												type: 'string',
												not: {
													const: 'open',
												},
											},
										},
									},
								},
							},
						},
						type: 'object',
						required: ['active', 'type'],
						properties: {
							active: {
								type: 'boolean',
								const: true,
							},
							type: {
								type: 'string',
								const: 'pattern@1.0.0',
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
						const: 'improvement@1.0.0',
					},
					data: {
						type: 'object',
						required: ['status'],
						properties: {
							status: {
								type: 'string',
								const: IMPROVEMENT_COMPLETE_STATUS,
							},
						},
					},
				},
			},
			action: 'action-update-card@1.0.0',
			target: {
				$map: {
					$eval:
						"source.links['is attached to'][0].links['is attached to'][0:]",
				},
				'each(link)': {
					$eval: 'link.id',
				},
			},
			arguments: {
				reason:
					'Support Thread re-opened because linked Pattern was potentially resolved',
				patch: [
					{
						op: 'replace',
						path: '/data/status',
						value: 'open',
					},
				],
			},
		},
	};
