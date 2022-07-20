/*
 * This file was automatically generated by 'npm run types'.
 *
 * DO NOT MODIFY IT BY HAND!
 */

// tslint:disable: array-type

import type { Contract, ContractDefinition } from 'autumndb';

export type TLDR = string;
export type MilestonesProgress = number;
export type Status =
	| 'proposed'
	| 'researching'
	| 'awaiting-approval'
	| 'ready-to-implement'
	| 'implementation'
	| 'denied-or-failed'
	| 'completed';

export interface ImprovementData {
	description?: TLDR;
	specification?: string;
	milestonesPercentComplete?: MilestonesProgress;
	participants?: unknown[];
	mentionsUser?: unknown[];
	alertsUser?: unknown[];
	mentionsGroup?: unknown[];
	alertsGroup?: unknown[];
	status: Status;
	[k: string]: unknown;
}

export interface ImprovementContractDefinition
	extends ContractDefinition<ImprovementData> {}

export interface ImprovementContract extends Contract<ImprovementData> {}