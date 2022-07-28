import type { ContractDefinition } from 'autumndb';
import { account } from './account';
import { action } from './action';
import { actionRequest } from './action-request';
import { agentChannelSettings } from './agent-channel-settings';
import { blogPost } from './blog-post';
import { brainstormCall } from './brainstorm-call';
import { brainstormTopic } from './brainstorm-topic';
import { channel } from './channel';
import { chartConfiguration } from './chart-configuration';
import { checkin } from './checkin';
import { contact } from './contact';
import { contractRepository } from './contract-repository';
import { create } from './create';
import { execute } from './execute';
import { externalEvent } from './external-event';
import { faq } from './faq';
import { feedbackItem } from './feedback-item';
import { firstTimeLogin } from './first-time-login';
import { genericSource } from './generic-source';
import { group } from './group';
import { image } from './image';
import { imageSource } from './image-source';
import { improvement } from './improvement';
import { loopBalenaIo } from './loop-balena-io';
import { loopBalenalabs } from './loop-balenalabs';
import { loopCompanyOs } from './loop-company-os';
import { loopProductOs } from './loop-product-os';
import { loopTeamOs } from './loop-team-os';
import { message } from './message';
import { milestone } from './milestone';
import { notification } from './notification';
import { oauthProvider } from './oauth-provider';
import { opportunity } from './opportunity';
import { orgBalena } from './org-balena';
import { passwordReset } from './password-reset';
import { pattern } from './pattern';
import { ping } from './ping';
import { pipeline } from './pipeline';
import { product } from './product';
import { productBalenaCloud } from './product-balena-cloud';
import { productJellyfish } from './product-jellyfish';
import { project } from './project';
import { rating } from './rating';
import { reaction } from './reaction';
import { relationshipAccountHasBackupOwnerUser } from './relationship-account-has-backup-owner-user';
import { relationshipAccountHasContact } from './relationship-account-has-contact';
import { relationshipAccountIsOwnedByUser } from './relationship-account-is-owned-by-user';
import { relationshipAnyIsBookmarkedByUser } from './relationship-any-is-bookmarked-by-user';
import { relationshipAnyIsCreatorOfAny } from './relationship-any-is-creator-of-any';
import { relationshipAnyWasTransformedToAny } from './relationship-any-was-transformed-to-any';
import { relationshipAnyWasBuiltIntoAny } from './relationship-any-was-built-into-any';
import { relationshipBrainstormCallHasAttachedBrainstormTopic } from './relationship-brainstorm-call-has-attached-brainstorm-topic';
import { relationshipBrainstormTopicHasAttachedImprovement } from './relationship-brainstorm-topic-has-attached-improvement';
import { relationshipBrainstormTopicHasAttachedPattern } from './relationship-brainstorm-topic-has-attached-pattern';
import { relationshipBrainstormTopicHasAttachedSalesThread } from './relationship-brainstorm-topic-has-attached-sales-thread';
import { relationshipBrainstormTopicHasAttachedSupportThread } from './relationship-brainstorm-topic-has-attached-support-thread';
import { relationshipBrainstormTopicHasAttachedThread } from './relationship-brainstorm-topic-has-attached-thread';
import { relationshipChannelHasAgentUser } from './relationship-channel-has-agent-user';
import { relationshipChannelHasSettingsAgentChannelSettings } from './relationship-channel-has-settings-agent-channel-settings';
import { relationshipChartConfigurationIsAttachedToView } from './relationship-chart-configuration-is-attached-to-view';
import { relationshipCheckinIsAttendedByUser } from './relationship-checkin-is-attended-by-user';
import { relationshipContactHasBackupOwnerUser } from './relationship-contact-has-backup-owner-user';
import { relationshipContactIsAttachedToUser } from './relationship-contact-is-attached-to-user';
import { relationshipContactIsOwnedByUser } from './relationship-contact-is-owned-by-user';
import { relationshipContractRepositoryHasMemberAny } from './relationship-contract-repository-has-member-any';
import { relationshipCreateIsAttachedToAny } from './relationship-create-is-attached-to-any';
import { relationshipExecuteExecutesActionRequest } from './relationship-execute-executes-action-request';
import { relationshipFeedbackItemIsFeedbackForUser } from './relationship-feedback-item-is-feedback-for-user';
import { relationshipFirstTimeLoginIsAttachedToUser } from './relationship-first-time-login-is-attached-to-user';
import { relationshipGroupHasGroupMemberUser } from './relationship-group-has-group-member-user';
import { relationshipImprovementHasAttachedMilestone } from './relationship-improvement-has-attached-milestone';
import { relationshipImprovementHasDedicatedUserUser } from './relationship-improvement-has-dedicated-user-user';
import { relationshipImprovementIsAttachedToPattern } from './relationship-improvement-is-attached-to-pattern';
import { relationshipImprovementIsContributedToByUser } from './relationship-improvement-is-contributed-to-by-user';
import { relationshipImprovementIsGuidedByUser } from './relationship-improvement-is-guided-by-user';
import { relationshipImprovementIsImplementedByProject } from './relationship-improvement-is-implemented-by-project';
import { relationshipImprovementIsOwnedByUser } from './relationship-improvement-is-owned-by-user';
import { relationshipLoopHasThread } from './relationship-loop-has-thread';
import { relationshipLoopOwnsTransformer } from './relationship-loop-owns-transformer';
import { relationshipLoopHasSubLoop } from './relationship-loop-has-sub-loop';
import { relationshipMessageIsAttachedToAny } from './relationship-message-is-attached-to-any';
import { relationshipMilestoneIsOwnedByUser } from './relationship-milestone-is-owned-by-user';
import { relationshipMilestoneRequiresMilestone } from './relationship-milestone-requires-milestone';
import { relationshipNotificationIsAttachedToAny } from './relationship-notification-is-attached-to-any';
import { relationshipNotificationIsReadByUser } from './relationship-notification-is-read-by-user';
import { relationshipOpportunityHasBackupOwnerUser } from './relationship-opportunity-has-backup-owner-user';
import { relationshipOpportunityIsAttachedToAccount } from './relationship-opportunity-is-attached-to-account';
import { relationshipOpportunityIsOwnedByUser } from './relationship-opportunity-is-owned-by-user';
import { relationshipPasswordResetIsAttachedToUser } from './relationship-password-reset-is-attached-to-user';
import { relationshipPatternIsAttachedToSalesThread } from './relationship-pattern-is-attached-to-sales-thread';
import { relationshipPatternIsAttachedToSupportThread } from './relationship-pattern-is-attached-to-support-thread';
import { relationshipPatternIsAttachedToThread } from './relationship-pattern-is-attached-to-thread';
import { relationshipPatternIsOwnedByUser } from './relationship-pattern-is-owned-by-user';
import { relationshipPatternRelatesToPattern } from './relationship-pattern-relates-to-pattern';
import { relationshipProjectHasCheckin } from './relationship-project-has-checkin';
import { relationshipProjectHasMemberUser } from './relationship-project-has-member-user';
import { relationshipProjectImplementsMilestone } from './relationship-project-implements-milestone';
import { relationshipProjectIsContributedToByUser } from './relationship-project-is-contributed-to-by-user';
import { relationshipProjectIsGuidedByUser } from './relationship-project-is-guided-by-user';
import { relationshipProjectIsObservedByUser } from './relationship-project-is-observed-by-user';
import { relationshipProjectIsOwnedByUser } from './relationship-project-is-owned-by-user';
import { relationshipReactionIsAttachedToMessage } from './relationship-reaction-is-attached-to-message';
import { relationshipReactionIsAttachedToWhisper } from './relationship-reaction-is-attached-to-whisper';
import { relationshipSagaHasAttachedImprovement } from './relationship-saga-has-attached-improvement';
import { relationshipSalesThreadIsAttachedToOpportunity } from './relationship-sales-thread-is-attached-to-opportunity';
import { relationshipSalesThreadIsOwnedByUser } from './relationship-sales-thread-is-owned-by-user';
import { relationshipSubscriptionIsAttachedToAny } from './relationship-subscription-is-attached-to-any';
import { relationshipSupportThreadHasAttachedRating } from './relationship-support-thread-has-attached-rating';
import { relationshipSupportThreadIsOwnedByUser } from './relationship-support-thread-is-owned-by-user';
import { relationshipSupportThreadIsSourceForFeedbackItem } from './relationship-support-thread-is-source-for-feedback-item';
import { relationshipTaskGeneratedAny } from './relationship-task-generated-any';
import { relationshipTransformerGeneratedTask } from './relationship-transformer-generated-task';
import { relationshipTaskHasResultAny } from './relationship-task-has-result-any';
import { relationshipTransformerWorkerOwnsTask } from './relationship-transformer-worker-owns-task';
import { relationshipUpdateIsAttachedToAny } from './relationship-update-is-attached-to-any';
import { relationshipUserHasAttachedContactContact } from './relationship-user-has-attached-contact-contact';
import { relationshipUserHasNotification } from './relationship-user-has-notification';
import { relationshipUserHasSettingsAgentChannelSettings } from './relationship-user-has-settings-agent-channel-settings';
import { relationshipUserHasSettingsWorkingHours } from './relationship-user-has-settings-working-hours';
import { relationshipUserOwnsRating } from './relationship-user-owns-rating';
import { relationshipViewIsAttachedToChannel } from './relationship-view-is-attached-to-channel';
import { relationshipWhisperIsAttachedToMilestone } from './relationship-whisper-is-attached-to-milestone';
import { relationshipWhisperIsAttachedToSalesThread } from './relationship-whisper-is-attached-to-sales-thread';
import { relationshipWhisperIsAttachedToSupportThread } from './relationship-whisper-is-attached-to-support-thread';
import { relationshipWhisperIsAttachedToThread } from './relationship-whisper-is-attached-to-thread';
import { roleLoop } from './role-loop';
import { roleTransformerWorker } from './role-transformer-worker';
import { roleUserExternalSupport } from './role-user-external-support';
import { saga } from './saga';
import { salesThread } from './sales-thread';
import { scheduledAction } from './scheduled-action';
import { serviceSource } from './service-source';
import { subscription } from './subscription';
import { summary } from './summary';
import { supportThread } from './support-thread';
import { tag } from './tag';
import { task } from './task';
import { thread } from './thread';
import { transformer } from './transformer';
import { transformerWorker } from './transformer-worker';
import { triggeredAction } from './triggered-action';
import { triggeredActionBootstrapChannel } from './triggered-action-bootstrap-channel';
import { triggeredActionDirectMessageSubscription } from './triggered-action-direct-message-subscription';
import { triggeredActionHangoutsLink } from './triggered-action-hangouts-link';
import { triggeredActionIncrementTag } from './triggered-action-increment-tag';
import { triggeredActionIntegrationImportEvent } from './triggered-action-integration-import-event';
import { triggeredActionMatchmakeTask } from './triggered-action-matchmake-task';
import { triggeredActionMergeDraftVersion } from './triggered-action-merge-draft-version';
import { triggeredActionOrgCreationMembership } from './triggered-action-org-creation-membership';
import { triggeredActionSetUserAvatar } from './triggered-action-set-user-avatar';
import { triggeredActionSupportCompletedImprovementReopen } from './triggered-action-support-completed-improvement-reopen';
import { triggeredActionSupportReopen } from './triggered-action-support-reopen';
import { triggeredActionSupportSummary } from './triggered-action-support-summary';
import { triggeredActionSyncThreadPostLinkWhisper } from './triggered-action-sync-thread-post-link-whisper';
import { triggeredActionUpdateEventEditedAt } from './triggered-action-update-event-edited-at';
import { triggeredActionUserContact } from './triggered-action-user-contact';
import { update } from './update';
import { userGuest } from './user-guest';
import { viewActive } from './view-active';
import { viewActiveTriggeredActions } from './view-active-triggered-actions';
import { viewAllBlogPosts } from './view-all-blog-posts';
import { viewAllBrainstormCalls } from './view-all-brainstorm-calls';
import { viewAllBrainstormTopics } from './view-all-brainstorm-topics';
import { viewAllContacts } from './view-all-contacts';
import { viewAllCustomers } from './view-all-customers';
import { viewAllFaqs } from './view-all-faqs';
import { viewAllGroups } from './view-all-groups';
import { viewAllImprovements } from './view-all-improvements';
import { viewAllJellyfishSupportThreads } from './view-all-jellyfish-support-threads';
import { viewAllOpportunities } from './view-all-opportunities';
import { viewAllPatterns } from './view-all-patterns';
import { viewAllProjects } from './view-all-projects';
import { viewAllSagas } from './view-all-sagas';
import { viewAllSalesThreads } from './view-all-sales-threads';
import { viewAllTransformerTypes } from './view-all-transformer-types';
import { viewAllTransformerWorkers } from './view-all-transformer-workers';
import { viewAllTransformers } from './view-all-transformers';
import { viewAllViews } from './view-all-views';
import { viewCustomerSuccessSupportThreads } from './view-customer-success-support-threads';
import { viewMyConversations } from './view-my-conversations';
import { viewMyOpportunities } from './view-my-opportunities';
import { viewMyOrgs } from './view-my-orgs';
import { viewNonExecutedActionRequests } from './view-non-executed-action-requests';
import { viewPaidSupportThreads } from './view-paid-support-threads';
import { viewScheduledActions } from './view-scheduled-actions';
import { viewSecuritySupportThreads } from './view-security-support-threads';
import { viewSupportThreadsParticipation } from './view-support-threads-participation';
import { viewWorkflows } from './view-workflows';
import { webPushSubscription } from './web-push-subscription';
import { whisper } from './whisper';
import { workflow } from './workflow';
import { workingHours } from './working-hours';

export const contracts: ContractDefinition[] = [
	account,
	action,
	actionRequest,
	agentChannelSettings,
	blogPost,
	brainstormCall,
	brainstormTopic,
	channel,
	chartConfiguration,
	checkin,
	contact,
	contractRepository,
	create,
	execute,
	externalEvent,
	faq,
	feedbackItem,
	firstTimeLogin,
	genericSource,
	group,
	image,
	imageSource,
	improvement,
	loopBalenaIo,
	loopBalenalabs,
	loopCompanyOs,
	loopProductOs,
	loopTeamOs,
	message,
	opportunity,
	orgBalena,
	passwordReset,
	pattern,
	ping,
	pipeline,
	productBalenaCloud,
	productJellyfish,
	milestone,
	notification,
	oauthProvider,
	product,
	project,
	rating,
	reaction,
	relationshipAccountHasBackupOwnerUser,
	relationshipAccountHasContact,
	relationshipAccountIsOwnedByUser,
	relationshipAnyIsBookmarkedByUser,
	relationshipAnyIsCreatorOfAny,
	relationshipAnyWasTransformedToAny,
	relationshipAnyWasBuiltIntoAny,
	relationshipBrainstormCallHasAttachedBrainstormTopic,
	relationshipBrainstormTopicHasAttachedImprovement,
	relationshipBrainstormTopicHasAttachedPattern,
	relationshipBrainstormTopicHasAttachedSalesThread,
	relationshipBrainstormTopicHasAttachedSupportThread,
	relationshipBrainstormTopicHasAttachedThread,
	relationshipChannelHasAgentUser,
	relationshipChannelHasSettingsAgentChannelSettings,
	relationshipChartConfigurationIsAttachedToView,
	relationshipCheckinIsAttendedByUser,
	relationshipContactHasBackupOwnerUser,
	relationshipContactIsAttachedToUser,
	relationshipContactIsOwnedByUser,
	relationshipContractRepositoryHasMemberAny,
	relationshipCreateIsAttachedToAny,
	relationshipExecuteExecutesActionRequest,
	relationshipFeedbackItemIsFeedbackForUser,
	relationshipFirstTimeLoginIsAttachedToUser,
	relationshipGroupHasGroupMemberUser,
	relationshipImprovementHasAttachedMilestone,
	relationshipImprovementHasDedicatedUserUser,
	relationshipImprovementIsAttachedToPattern,
	relationshipImprovementIsContributedToByUser,
	relationshipImprovementIsGuidedByUser,
	relationshipImprovementIsImplementedByProject,
	relationshipImprovementIsOwnedByUser,
	relationshipLoopHasThread,
	relationshipLoopOwnsTransformer,
	relationshipLoopHasSubLoop,
	relationshipMessageIsAttachedToAny,
	relationshipMilestoneIsOwnedByUser,
	relationshipMilestoneRequiresMilestone,
	relationshipNotificationIsAttachedToAny,
	relationshipNotificationIsReadByUser,
	relationshipOpportunityHasBackupOwnerUser,
	relationshipOpportunityIsAttachedToAccount,
	relationshipOpportunityIsOwnedByUser,
	relationshipPasswordResetIsAttachedToUser,
	relationshipPatternIsAttachedToSalesThread,
	relationshipPatternIsAttachedToSupportThread,
	relationshipPatternIsAttachedToThread,
	relationshipPatternIsOwnedByUser,
	relationshipPatternRelatesToPattern,
	relationshipProjectHasCheckin,
	relationshipProjectHasMemberUser,
	relationshipProjectImplementsMilestone,
	relationshipProjectIsContributedToByUser,
	relationshipProjectIsGuidedByUser,
	relationshipProjectIsObservedByUser,
	relationshipProjectIsOwnedByUser,
	relationshipReactionIsAttachedToMessage,
	relationshipReactionIsAttachedToWhisper,
	relationshipSagaHasAttachedImprovement,
	relationshipSalesThreadIsAttachedToOpportunity,
	relationshipSalesThreadIsOwnedByUser,
	relationshipSubscriptionIsAttachedToAny,
	relationshipSupportThreadHasAttachedRating,
	relationshipSupportThreadIsOwnedByUser,
	relationshipSupportThreadIsSourceForFeedbackItem,
	relationshipTaskGeneratedAny,
	relationshipTransformerGeneratedTask,
	relationshipTaskHasResultAny,
	relationshipTransformerWorkerOwnsTask,
	relationshipUpdateIsAttachedToAny,
	relationshipUserHasAttachedContactContact,
	relationshipUserHasNotification,
	relationshipUserHasSettingsAgentChannelSettings,
	relationshipUserHasSettingsWorkingHours,
	relationshipUserOwnsRating,
	relationshipViewIsAttachedToChannel,
	relationshipWhisperIsAttachedToMilestone,
	relationshipWhisperIsAttachedToSalesThread,
	relationshipWhisperIsAttachedToSupportThread,
	relationshipWhisperIsAttachedToThread,
	roleLoop,
	roleTransformerWorker,
	roleUserExternalSupport,
	saga,
	salesThread,
	scheduledAction,
	serviceSource,
	subscription,
	summary,
	supportThread,
	tag,
	task,
	thread,
	transformer,
	transformerWorker,
	triggeredAction,
	triggeredActionBootstrapChannel,
	triggeredActionDirectMessageSubscription,
	triggeredActionHangoutsLink,
	triggeredActionIncrementTag,
	triggeredActionIntegrationImportEvent,
	triggeredActionMatchmakeTask,
	triggeredActionMergeDraftVersion,
	triggeredActionOrgCreationMembership,
	triggeredActionSetUserAvatar,
	triggeredActionSupportCompletedImprovementReopen,
	triggeredActionSupportReopen,
	triggeredActionSupportSummary,
	triggeredActionSyncThreadPostLinkWhisper,
	triggeredActionUpdateEventEditedAt,
	triggeredActionUserContact,
	update,
	userGuest,
	viewActive,
	viewActiveTriggeredActions,
	viewAllJellyfishSupportThreads,
	viewAllTransformerTypes,
	viewAllTransformerWorkers,
	viewAllTransformers,
	viewAllViews,
	viewAllBlogPosts,
	viewAllBrainstormCalls,
	viewAllBrainstormTopics,
	viewAllContacts,
	viewAllCustomers,
	viewAllFaqs,
	viewAllGroups,
	viewAllImprovements,
	viewAllOpportunities,
	viewAllPatterns,
	viewAllProjects,
	viewAllSagas,
	viewAllSalesThreads,
	viewCustomerSuccessSupportThreads,
	viewMyConversations,
	viewMyOpportunities,
	viewMyOrgs,
	viewNonExecutedActionRequests,
	viewPaidSupportThreads,
	viewScheduledActions,
	viewSecuritySupportThreads,
	viewSupportThreadsParticipation,
	viewWorkflows,
	webPushSubscription,
	whisper,
	workflow,
	workingHours,
];
