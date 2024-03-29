/*
 * This file was automatically generated by 'npm run types'.
 *
 * DO NOT MODIFY IT BY HAND!
 */

// tslint:disable: array-type

import type { Contract, ContractDefinition } from 'autumndb';

export type Status = 'open' | 'in-progress' | 'denied-or-failed' | 'completed';
export type Progress = number;
export type Description = string;

export interface MilestoneData {
	status: Status;
	percentComplete?: Progress;
	description?: Description;
	participants?: unknown[];
	mentionsUser?: unknown[];
	alertsUser?: unknown[];
	mentionsGroup?: unknown[];
	alertsGroup?: unknown[];
	[k: string]: unknown;
}

export type MilestoneContractDefinition = ContractDefinition<MilestoneData>;

export type MilestoneContract = Contract<MilestoneData>;
