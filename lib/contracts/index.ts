import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { contact } from './contact';
import { create } from './create';
import { genericSource } from './generic-source';
import { image } from './image';
import { imageSource } from './image-source';
import { oauthProvider } from './oauth-provider';
import { relationshipAnyIsCreatorOfAny } from './relationship-any-is-creator-of-any';
import { relationshipContactHasBackupOwnerUser } from './relationship-contact-has-backup-owner-user';
import { relationshipContactIsAttachedToUser } from './relationship-contact-is-attached-to-user';
import { relationshipContactIsOwnedByUser } from './relationship-contact-is-owned-by-user';
import { relationshipCreateIsAttachedToAny } from './relationship-create-is-attached-to-any';
import { relationshipExecuteExecutesActionRequest } from './relationship-execute-executes-action-request';
import { relationshipLoopOwnsTransformer } from './relationship-loop-owns-transformer';
import { relationshipTaskGeneratedAny } from './relationship-task-generated-any';
import { relationshipTransformerGeneratedTask } from './relationship-transformer-generated-task';
import { relationshipTransformerWorkerOwnsTask } from './relationship-transformer-worker-owns-task';
import { relationshipUpdateIsAttachedToAny } from './relationship-update-is-attached-to-any';
import { relationshipUserHasAttachedContactContact } from './relationship-user-has-attached-contact-contact';
import { relationshipUserHasSettingsWorkingHours } from './relationship-user-has-settings-working-hours';
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
import { workingHours } from './working-hours';

export const contracts: ContractDefinition[] = [
	contact,
	create,
	genericSource,
	image,
	imageSource,
	relationshipAnyIsCreatorOfAny,
	relationshipContactHasBackupOwnerUser,
	relationshipContactIsAttachedToUser,
	relationshipContactIsOwnedByUser,
	relationshipCreateIsAttachedToAny,
	relationshipExecuteExecutesActionRequest,
	relationshipLoopOwnsTransformer,
	relationshipTaskGeneratedAny,
	relationshipTransformerGeneratedTask,
	relationshipTransformerWorkerOwnsTask,
	relationshipUpdateIsAttachedToAny,
	relationshipUserHasAttachedContactContact,
	relationshipUserHasSettingsWorkingHours,
	oauthProvider,
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
	workingHours,
];
