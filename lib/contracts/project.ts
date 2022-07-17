import type { ContractDefinition } from 'autumndb';
import * as contractMixins from './mixins';

const slug = 'project';
const type = 'type@1.0.0';

const statusOptions = [
	'implementation',
	'all-milestones-complete',
	'finalising-and-testing',
	'merged',
	'released',
	'denied-or-failed',
];

const statusNames = [
	'Implementation',
	'All milestones completed',
	'Finalising and testing',
	'Merged',
	'Released',
	'Denied or Failed',
];

export const project: ContractDefinition = contractMixins.mixin(
	contractMixins.withEvents(slug, type),
	contractMixins.asPipelineItem(
		slug,
		type,
		statusOptions,
		statusOptions[0],
		statusNames,
	),
)({
	slug,
	name: 'Project',
	type,
	data: {
		schema: {
			type: 'object',
			required: ['name'],
			properties: {
				name: {
					type: 'string',
					pattern: '^.*\\S.*$',
					fullTextSearch: true,
				},
				data: {
					type: 'object',
					properties: {
						description: {
							type: 'string',
							format: 'markdown',
						},
					},
				},
			},
		},
	},
});
