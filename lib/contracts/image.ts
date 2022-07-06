import type { ContractDefinition } from 'autumndb';
import { mergeProperties } from './transformer-merge-properties';

export const image: ContractDefinition = {
	slug: 'image',
	version: '1.0.0',
	name: 'Container image contract',
	type: 'type@1.0.0',
	markers: [],
	data: {
		schema: {
			type: 'object',
			properties: {
				data: {
					type: 'object',
					properties: {
						$transformer: {
							type: 'object',
							properties: {
								...mergeProperties,
							},
						},
					},
				},
			},
			required: ['data'],
		},
	},
};
