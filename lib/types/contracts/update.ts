/*
 * This file was automatically generated by 'npm run types'.
 *
 * DO NOT MODIFY IT BY HAND!
 */

// tslint:disable: array-type

import type { Contract, ContractDefinition } from 'autumndb';

export interface UpdateData {
	timestamp: string;
	target: string;
	actor: string;
	payload: unknown[];
	[k: string]: unknown;
}

export interface UpdateContractDefinition
	extends ContractDefinition<UpdateData> {}

export interface UpdateContract extends Contract<UpdateData> {}