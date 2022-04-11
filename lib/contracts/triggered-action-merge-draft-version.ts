import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import type { TriggeredActionData } from '../types';

export const triggeredActionMergeDraftVersion: ContractDefinition<TriggeredActionData> =
	{
		slug: 'triggered-action-auto-merge',
		version: '1.0.0',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for merging draft versions to final versions',
		markers: [],
		data: {
			schedule: 'enqueue',
			filter: {
				type: 'object',
				required: ['active', 'data'],
				properties: {
					active: {
						type: 'boolean',
						const: true,
					},
					data: {
						type: 'object',
						required: ['$transformer'],
						properties: {
							$transformer: {
								type: 'object',
								required: [
									'parentMerged',
									'mergeable',
									'merged',
									'finalVersion',
								],
								properties: {
									artifactReady: {
										not: {
											const: false,
										},
									},
									mergeable: {
										type: 'boolean',
										const: true,
									},
									parentMerged: {
										type: 'boolean',
										const: true,
									},
									merged: {
										type: 'boolean',
										not: {
											const: true,
										},
									},
									finalVersion: {
										type: 'boolean',
										not: {
											const: true,
										},
									},
								},
							},
						},
					},
				},
			},
			action: 'action-merge-draft-version@1.0.0',
			target: {
				$eval: 'source.id',
			},
			arguments: {},
		},
	};
