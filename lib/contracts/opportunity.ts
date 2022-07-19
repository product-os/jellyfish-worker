import {
	ContractDefinition,
	contractMixins as autumndbContractMixins,
} from 'autumndb';
import * as contractMixins from './mixins';

const slug = 'opportunity';
const type = 'type@1.0.0';
const statusOptions = [
	'Created',
	'Discovery',
	'Evaluation',
	'Committed ',
	'Closed Won',
	'Closed Lost',
];

export const opportunity: ContractDefinition = contractMixins.mixin(
	contractMixins.withEvents(slug, type),
	contractMixins.asPipelineItem(slug, type, statusOptions, statusOptions[0]),
)({
	slug,
	name: 'Opportunity',
	type,
	markers: [],
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
						status: {
							title: 'Status',
							type: 'string',
							default: 'Created',
							enum: [
								'Created',
								'Discovery',
								'Evaluation',
								'Committed ',
								'Closed Won',
								'Closed Lost',
							],
						},
						dueDate: {
							title: 'Expected close date',
							type: 'string',
							format: 'date',
						},
						recurringValue: {
							title: 'Estimated recurring value',
							type: 'number',
							format: 'currency',
							minimum: 0,
						},
						nonRecurringValue: {
							title: 'Estimated non-recurring value',
							type: 'number',
							format: 'currency',
							minimum: 0,
						},
						totalValue: {
							title: 'Total value',
							type: 'number',
							format: 'currency',
							$$formula:
								'SUM([contract.data.recurringValue, contract.data.nonRecurringValue])',
							minimum: 0,
						},
						device: {
							title: 'Device Type',
							type: 'string',
						},
						usecase: {
							title: 'Use case(s)',
							type: 'string',
							format: 'markdown',
						},
						stack: {
							title: 'Tech stack',
							type: 'string',
							format: 'markdown',
						},
					},
					required: ['status'],
				},
			},
		},
		uiSchema: {
			fields: {
				data: {
					status: {
						'ui:Widget': 'Badge',
					},
					dueDate: autumndbContractMixins.uiSchemaDef('date'),
				},
			},
		},
		slices: ['properties.data.properties.status'],
	},
});
