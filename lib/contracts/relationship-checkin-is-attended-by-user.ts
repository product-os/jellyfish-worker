import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipCheckinIsAttendedByUser: RelationshipContractDefinition =
	{
		slug: 'relationship-checkin-is-attended-by-user',
		type: 'relationship@1.0.0',
		name: 'is attended by',
		data: {
			inverseName: 'attended',
			title: 'Attendee',
			inverseTitle: 'Checkin',
			from: {
				type: 'checkin',
			},
			to: {
				type: 'user',
			},
		},
	};
