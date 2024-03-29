/*
 * This file was automatically generated by 'npm run types'.
 *
 * DO NOT MODIFY IT BY HAND!
 */

// tslint:disable: array-type

import type { Contract, ContractDefinition } from 'autumndb';

export interface FirstTimeLoginData {
	requestedAt?: string;
	expiresAt?: string;
	firstTimeLoginToken?: string;
	[k: string]: unknown;
}

export type FirstTimeLoginContractDefinition =
	ContractDefinition<FirstTimeLoginData>;

export type FirstTimeLoginContract = Contract<FirstTimeLoginData>;
