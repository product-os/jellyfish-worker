/*
 * This file was automatically generated by 'npm run types'.
 *
 * DO NOT MODIFY IT BY HAND!
 */

// tslint:disable: array-type

import type { Contract, ContractDefinition } from 'autumndb';

export interface TagData {
	count?: number;
	color?: string;
	description?: string;
	[k: string]: unknown;
}

export interface TagContractDefinition extends ContractDefinition<TagData> {}

export interface TagContract extends Contract<TagData> {}