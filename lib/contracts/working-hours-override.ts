import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { asTimeZone } from './mixins';
import { timeSlots } from './working-hours';

export const workingHoursOverride: ContractDefinition = {
	slug: 'working-hours',
	type: 'type@1.0.0',
	name: 'Working hours',
	data: {
		schema: {
			type: 'object',
			properties: {
				slug: {
					type: 'string',
					pattern: '^working-hours-[a-z0-9-]+$',
				},
				data: {
					type: 'object',
					required: ['timeZone', 'startDate', 'endDate', 'timeSlots'],
					properties: {
						timeZone: {
							title: 'Time zone',
							...asTimeZone(),
						},
						startDate: {
							title: 'Start date',
							type: 'string',
							format: 'date-time',
						},
						endDate: {
							title: 'End date',
							type: 'string',
							format: 'date-time',
						},
						timeSlots: {
							title: 'Preferred working hours',
							...timeSlots(),
						},
					},
				},
			},
		},
	},
};
