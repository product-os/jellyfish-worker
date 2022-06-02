import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { asTimeZone } from './mixins';

export function asTimeSlot() {
	const slot: string[] = [];

	const hours: string[] = [];
	for (let hour = 0; hour < 24; hour++) {
		hour < 10 ? hours.push(`0${hour}`) : hours.push(`${hour}`);
	}
	const minutes = ['00', '30'];
	for (const hour of hours) {
		for (const minute of minutes) {
			slot.push(`${hour}:${minute}`);
		}
	}

	return slot;
}

function timeSlots() {
	const properties: any = {};
	for (const day of [
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday',
	]) {
		properties[day] = {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					from: {
						type: 'string',
						title: 'Start time',
						enum: asTimeSlot(),
					},
					to: {
						type: 'string',
						title: 'End time',
						enum: asTimeSlot(),
					},
					preference: {
						type: 'number',
						title: 'Preference',
						default: 0,
						enum: [0, 1, 2, 3],
					},
				},
			},
		};
	}

	return {
		type: 'object',
		properties,
	};
}

export const workingHours: ContractDefinition = {
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
					required: ['timeZone'],
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
