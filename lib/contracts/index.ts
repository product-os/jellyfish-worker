import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { agentSettings } from './agent-settings';
import { contact } from './contact';
import { create } from './create';
import { genericSource } from './generic-source';
import { image } from './image';
import { imageSource } from './image-source';
import { roleTransformerWorker } from './role-transformer-worker';
import { scheduledAction } from './scheduled-action';
import { serviceSource } from './service-source';
import { task } from './task';
import { transformer } from './transformer';
import { transformerWorker } from './transformer-worker';
import { triggeredAction } from './triggered-action';
import { triggeredActionMatchmakeTask } from './triggered-action-matchmake-task';
import { triggeredActionMergeDraftVersion } from './triggered-action-merge-draft-version';
import { update } from './update';
import { viewAllTransformerTypes } from './view-all-transformer-types';
import { viewAllTransformerWorkers } from './view-all-transformer-workers';
import { viewAllTransformers } from './view-all-transformers';
import { viewAllViews } from './view-all-views';
import { viewScheduledActions } from './view-scheduled-actions';

export const contracts: ContractDefinition[] = [
	agentSettings,
	contact,
	create,
	genericSource,
	image,
	imageSource,
	roleTransformerWorker,
	scheduledAction,
	serviceSource,
	task,
	transformer,
	transformerWorker,
	triggeredAction,
	triggeredActionMatchmakeTask,
	triggeredActionMergeDraftVersion,
	update,
	viewAllTransformerTypes,
	viewAllTransformerWorkers,
	viewAllTransformers,
	viewAllViews,
	viewScheduledActions,
];
