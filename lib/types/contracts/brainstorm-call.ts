/*
 * This file was automatically generated by 'npm run types'.
 *
 * DO NOT MODIFY IT BY HAND!
 */

// tslint:disable: array-type

import type { Contract, ContractDefinition } from 'autumndb';

export type MeetingDateTime = string;

export interface BrainstormCallData {
	datetime: MeetingDateTime;
	[k: string]: unknown;
}

export type BrainstormCallContractDefinition =
	ContractDefinition<BrainstormCallData>;

export type BrainstormCallContract = Contract<BrainstormCallData>;
