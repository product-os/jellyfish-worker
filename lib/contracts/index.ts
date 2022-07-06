import type { ContractDefinition } from 'autumndb';
import { action } from './action';
import { actionRequest } from './action-request';
import { agentChannelSettings } from './agent-channel-settings';
import { channel } from './channel';
import { contact } from './contact';
import { contractRepository } from './contract-repository';
import { create } from './create';
import { execute } from './execute';
import { genericSource } from './generic-source';
import { image } from './image';
import { imageSource } from './image-source';
import { oauthProvider } from './oauth-provider';
import { relationshipAnyIsCreatorOfAny } from './relationship-any-is-creator-of-any';
import { relationshipAnyWasTransformedToAny } from './relationship-any-was-transformed-to-any';
import { relationshipChannelHasAgentUser } from './relationship-channel-has-agent-user';
import { relationshipChannelHasSettingsAgentChannelSettings } from './relationship-channel-has-settings-agent-channel-settings';
import { relationshipContactHasBackupOwnerUser } from './relationship-contact-has-backup-owner-user';
import { relationshipContactIsAttachedToUser } from './relationship-contact-is-attached-to-user';
import { relationshipContactIsOwnedByUser } from './relationship-contact-is-owned-by-user';
import { relationshipContractRepositoryHasMemberAny } from './relationship-contract-repository-has-member-any';
import { relationshipCreateIsAttachedToAny } from './relationship-create-is-attached-to-any';
import { relationshipExecuteExecutesActionRequest } from './relationship-execute-executes-action-request';
import { relationshipLoopOwnsTransformer } from './relationship-loop-owns-transformer';
import { relationshipTaskGeneratedAny } from './relationship-task-generated-any';
import { relationshipTaskHasResultAny } from './relationship-task-has-result-any';
import { relationshipTransformerGeneratedTask } from './relationship-transformer-generated-task';
import { relationshipTransformerWorkerOwnsTask } from './relationship-transformer-worker-owns-task';
import { relationshipUpdateIsAttachedToAny } from './relationship-update-is-attached-to-any';
import { relationshipUserHasAttachedContactContact } from './relationship-user-has-attached-contact-contact';
import { relationshipUserHasSettingsAgentChannelSettings } from './relationship-user-has-settings-agent-channel-settings';
import { relationshipUserHasSettingsWorkingHours } from './relationship-user-has-settings-working-hours';
import { relationshipViewIsAttachedToChannel } from './relationship-view-is-attached-to-channel';
import { roleTransformerWorker } from './role-transformer-worker';
import { scheduledAction } from './scheduled-action';
import { serviceSource } from './service-source';
import { task } from './task';
import { transformer } from './transformer';
import { transformerWorker } from './transformer-worker';
import { triggeredAction } from './triggered-action';
import { triggeredActionBootstrapChannel } from './triggered-action-bootstrap-channel';
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
	action,
	actionRequest,
	agentChannelSettings,
	channel,
	contact,
	contractRepository,
	create,
	execute,
	genericSource,
	image,
	imageSource,
	relationshipAnyIsCreatorOfAny,
	relationshipAnyWasTransformedToAny,
	relationshipChannelHasAgentUser,
	relationshipChannelHasSettingsAgentChannelSettings,
	relationshipContactHasBackupOwnerUser,
	relationshipContactIsAttachedToUser,
	relationshipContactIsOwnedByUser,
	relationshipContractRepositoryHasMemberAny,
	relationshipCreateIsAttachedToAny,
	relationshipExecuteExecutesActionRequest,
	relationshipLoopOwnsTransformer,
	relationshipTaskGeneratedAny,
	relationshipTaskHasResultAny,
	relationshipTransformerGeneratedTask,
	relationshipTransformerWorkerOwnsTask,
	relationshipUpdateIsAttachedToAny,
	relationshipUserHasAttachedContactContact,
	relationshipUserHasSettingsAgentChannelSettings,
	relationshipUserHasSettingsWorkingHours,
	relationshipViewIsAttachedToChannel,
	oauthProvider,
	roleTransformerWorker,
	scheduledAction,
	serviceSource,
	task,
	transformer,
	transformerWorker,
	triggeredAction,
	triggeredActionBootstrapChannel,
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
