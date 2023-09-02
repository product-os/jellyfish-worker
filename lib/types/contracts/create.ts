/*
 * This file was automatically generated by 'npm run types'.
 *
 * DO NOT MODIFY IT BY HAND!
 */

// tslint:disable: array-type

import type { Contract, ContractDefinition } from 'autumndb';

export interface CreateData {
	timestamp: string;
	target: string;
	actor: string;
	payload?:
		| {
				[k: string]: unknown;
		  }
		| unknown[];
	[k: string]: unknown;
}

export type CreateContractDefinition = ContractDefinition<CreateData>;

export type CreateContract = Contract<CreateData>;
