import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import _ from 'lodash';

const defaultStatusOptions = ['open', 'closed', 'archived'];

/**
 * @summary Defines fields common to all items used in pipelines
 * @function
 *
 * @param slug - contract slug
 * @param type - contract type
 * @param statusOptions - list of status names to fallback to
 * @param defaultStatus - default status name
 * @param statusNames - list of status names to override statusOptions
 * @returns contract definition with pipeline properties
 */
export function asPipelineItem(
	slug: string,
	type: string,
	statusOptions = defaultStatusOptions,
	defaultStatus = 'open',
	statusNames: string[] | null = null,
): ContractDefinition {
	return {
		slug,
		type,
		data: {
			schema: {
				properties: {
					data: {
						type: 'object',
						required: ['status'],
						properties: {
							status: {
								title: 'Status',
								type: 'string',
								default: defaultStatus,
								enum: statusOptions,
								enumNames: statusNames || statusOptions.map(_.startCase),
							},
						},
					},
				},
				required: ['data'],
			},
			uiSchema: {
				fields: {
					data: {
						status: {
							'ui:widget': 'Badge',
						},
					},
				},
			},
			slices: ['properties.data.properties.status'],
			indexed_fields: [['data.status']],
		},
	};
}
