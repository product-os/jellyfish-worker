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

const timeSlots = {
	type: 'array',
	items: {
		type: 'object',
		required: ['timeSlot', 'preference'],
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
				type: 'string',
				title: 'Preference',
				default: 'Most preferred',
				enum: ['Most preferred', 'Less preferred', 'Least preferred'],
			},
		},
	},
};

export const agentSettings: ContractDefinition = {
	slug: 'agent-settings',
	type: 'type@1.0.0',
	name: 'Agent Settings',
	data: {
		schema: {
			type: 'object',
			properties: {
				slug: {
					type: 'string',
					pattern: '^agent-settings-[a-z0-9-]+$',
				},
				data: {
					type: 'object',
					required: ['default'],
					properties: {
						default: {
							type: 'object',
							required: ['timeZone'],
							properties: {
								timeZone: {
									title: 'Default time zone',
									...asTimeZone(),
								},
								timeSlots: {
									title: 'Default preferred working hours',
									...timeSlots,
								},
							},
						},
						overrides: {
							title: 'Overrides',
							type: 'array',
							items: {
								type: 'object',
								required: ['start', 'end', 'timeZone', 'timeSlots'],
								properties: {
									start: {
										title: 'Start date',
										type: 'string',
										format: 'date',
									},
									end: {
										title: 'End date',
										type: 'string',
										format: 'date',
									},
									timeZone: {
										title: 'Time zone',
										...asTimeZone(),
									},
									timeSlots: {
										title: 'Preferred working hours',
										...timeSlots,
									},
								},
							},
						},
					},
				},
			},
		},
	},
};
