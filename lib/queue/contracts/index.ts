import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { action } from './action';
import { actionRequest } from './action-request';
import { execute } from './execute';

export const contracts: ContractDefinition[] = [action, actionRequest, execute];
