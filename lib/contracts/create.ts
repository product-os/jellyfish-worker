import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

export const create: ContractDefinition = {
	slug: 'create',
	type: 'type@1.0.0',
	version: '1.0.0',
	name: 'The contract create event',
	markers: [],
	tags: [],
	active: true,
	data: {
		schema: {
			type: 'object',
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
						},
						target: {
							type: 'string',
							format: 'uuid',
						},
						actor: {
							type: 'string',
							format: 'uuid',
						},
						payload: {
							type: ['object', 'array'],
						},
					},
					required: ['timestamp', 'target', 'actor'],
				},
			},
			required: ['version', 'data'],
		},
	},
	requires: [],
	capabilities: [],
};
