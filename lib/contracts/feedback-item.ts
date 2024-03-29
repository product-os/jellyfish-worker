import type { ContractDefinition } from 'autumndb';

export const feedbackItem: ContractDefinition = {
	slug: 'feedback-item',
	name: 'Feedback item',
	type: 'type@1.0.0',
	markers: [],
	data: {
		schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					pattern: '^.*\\S.*$',
				},
				data: {
					type: 'object',
					properties: {
						feedback: {
							type: 'object',
							properties: {
								empathy: {
									title: 'Empathy',
									type: 'number',
									enum: [1, 0, -1],
								},
								knowledge: {
									title: 'Technical knowledge',
									type: 'number',
									enum: [1, 0, -1],
								},
								process: {
									title: 'Process',
									type: 'number',
									enum: [1, 0, -1],
								},
								grammar: {
									title: 'Grammar',
									type: 'number',
									enum: [1, 0, -1],
								},
								effort: {
									title: 'Going the extra mile',
									type: 'number',
									enum: [1, 0, -1],
								},
								notes: {
									type: 'string',
									format: 'markdown',
								},
							},
						},
					},
					required: ['feedback'],
				},
			},
			required: ['data'],
		},
	},
};
