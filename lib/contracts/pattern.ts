import type { ContractDefinition } from 'autumndb';
import * as contractMixins from './mixins';

const slug = 'pattern';
const type = 'type@1.0.0';
const statusOptions = [
	'open',
	'brainstorming',
	'improvement-in-progress',
	'partially-resolved',
	'resolved-pending-review',

	// A pattern is resolved when the problem it describes has been verified as fixed
	'closed-resolved',

	// A pattern may be closed without resolution if it is no longer deemed relevant
	// or, for whatever reason, cannot or will not be resolved.
	'closed-unresolved',
];

const statusNames = [
	'Open',
	'Brainstorming',
	'Improvement in progress',
	'Partially resolved',
	'Resolved (pending review)',
	'Closed (resolved)',
	'Closed (unresolved)',
];

export const pattern: ContractDefinition = contractMixins.mixin(
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
	name: 'Pattern',
	type,
	data: {
		schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					fullTextSearch: true,
				},
				data: {
					type: 'object',
					properties: {
						description: {
							type: 'string',
							format: 'markdown',
							fullTextSearch: true,
						},
						temporarySolution: {
							title: 'Temporary Solution',
							description:
								'Known workaround that can be used while a definitive solution does not yet exist',
							type: 'string',
							format: 'markdown',
							fullTextSearch: true,
						},
						improvementsPercentComplete: {
							title: 'Improvements progress',
							default: 0,
							type: 'number',
							readOnly: true,
							// eslint-disable-next-line max-len
							$$formula:
								'contract.links["has attached"] && contract.links["has attached"].length ? (FILTER(contract.links["has attached"], { type: "improvement@1.0.0", data: { status: "completed" } }).length / REJECT(FILTER(contract.links["has attached"], { type: "improvement@1.0.0" }), { data: { status: "denied-or-failed" } }).length) * 100 : 0',
						},
						weight: {
							description: 'How active the pattern is',
							default: 0,
							type: 'number',
							$$formula:
								'contract.links["has attached"].length + contract.links["is attached to"].length + contract.links["relates to"].length',
						},
					},
				},
			},
			required: ['name'],
		},
		uiSchema: {
			fields: {
				data: {
					improvementsPercentComplete: {
						'ui:widget': 'ProgressBar',
						'ui:options': {
							success: true,
							alignSelf: 'stretch',
							alignItems: 'stretch',
						},
					},
				},
			},
		},
	},
});
