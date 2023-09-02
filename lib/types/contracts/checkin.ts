/*
 * This file was automatically generated by 'npm run types'.
 *
 * DO NOT MODIFY IT BY HAND!
 */

// tslint:disable: array-type

import type { Contract, ContractDefinition } from 'autumndb';

export type CheckInDateTime = string;
export type Review = boolean;
export type TimeUntilNextCheckin = TimeUntilNextCheckin1 &
	TimeUntilNextCheckin2;
export type TimeUntilNextCheckin1 = number;
export type TimeUntilNextCheckin2 = Day | Week | Weeks | Month | Months;
export type Day = 86400;
export type Week = 345600;
export type Weeks = 1209600;
export type Month = 2419200;
export type Months = 7257600;
export type LengthOfNextCheckin = LengthOfNextCheckin1 & LengthOfNextCheckin2;
export type LengthOfNextCheckin1 = number;
export type LengthOfNextCheckin2 = Minutes | Minutes1 | Minutes2;
export type Minutes = 600;
export type Minutes1 = 1800;
export type Minutes2 = 3000;
export type ExtraAttendeesNeeded = Array<{
	user?: string;
	role?: 'owner' | 'guide' | 'dedicated' | 'contributor' | 'observer';
	[k: string]: unknown;
}>;
export type UnnecessaryAttendees = string[];

export interface CheckinData {
	datetime?: CheckInDateTime;
	is_review?: Review;
	interval_to_next?: TimeUntilNextCheckin;
	length_of_next?: LengthOfNextCheckin;
	minutes?: string;
	extra_attendees_needed?: ExtraAttendeesNeeded;
	unnecessary_attendees?: UnnecessaryAttendees;
	participants?: unknown[];
	mentionsUser?: unknown[];
	alertsUser?: unknown[];
	mentionsGroup?: unknown[];
	alertsGroup?: unknown[];
	[k: string]: unknown;
}

export type CheckinContractDefinition = ContractDefinition<CheckinData>;

export type CheckinContract = Contract<CheckinData>;
