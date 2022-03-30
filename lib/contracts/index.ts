import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { contact } from './contact';
import { create } from './create';
import { scheduledAction } from './scheduled-action';
import { triggeredAction } from './triggered-action';
import { update } from './update';
import { viewAllViews } from './view-all-views';
import { viewScheduledActions } from './view-scheduled-actions';

export const contracts: ContractDefinition[] = [
	contact,
	create,
	scheduledAction,
	triggeredAction,
	update,
	viewAllViews,
	viewScheduledActions,
];
