import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

export const task: ContractDefinition = {
	slug: 'task',
	version: '1.0.0',
	name: 'Task',
	type: 'type@1.0.0',
	data: {
		schema: {
			type: 'object',
			required: ['data'],
			properties: {
				data: {
					type: 'object',
					required: ['actor', 'input', 'status', 'transformer'],
					properties: {
						actor: {
							type: 'string',
						},
						input: {
							type: 'object',
							required: ['id'],
							properties: {
								id: {
									type: 'string',
								},
							},
						},
						status: {
							type: 'string',
						},
						transformer: {
							type: 'object',
							required: ['id'],
							properties: {
								id: {
									type: 'string',
								},
							},
						},
					},
				},
			},
		},
	},
};
