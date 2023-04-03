import type { ContractDefinition } from 'autumndb';
import { account } from './account';
import { action } from './action';
import { actionRequest } from './action-request';
import { blogPost } from './blog-post';
import { brainstormCall } from './brainstorm-call';
import { brainstormTopic } from './brainstorm-topic';
import { channel } from './channel';
import { checkin } from './checkin';
import { contact } from './contact';
import { create } from './create';
import { externalEvent } from './external-event';
import { faq } from './faq';
import { feedbackItem } from './feedback-item';
import { firstTimeLogin } from './first-time-login';
import { group } from './group';
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
import { relationshipBrainstormCallHasAttachedBrainstormTopic } from './relationship-brainstorm-call-has-attached-brainstorm-topic';
import { relationshipBrainstormTopicHasAttachedImprovement } from './relationship-brainstorm-topic-has-attached-improvement';
import { relationshipBrainstormTopicHasAttachedPattern } from './relationship-brainstorm-topic-has-attached-pattern';
import { relationshipBrainstormTopicHasAttachedSalesThread } from './relationship-brainstorm-topic-has-attached-sales-thread';
import { relationshipBrainstormTopicHasAttachedSupportThread } from './relationship-brainstorm-topic-has-attached-support-thread';
import { relationshipCheckinIsAttendedByUser } from './relationship-checkin-is-attended-by-user';
import { relationshipContactHasBackupOwnerUser } from './relationship-contact-has-backup-owner-user';
import { relationshipContactIsAttachedToUser } from './relationship-contact-is-attached-to-user';
import { relationshipContactIsOwnedByUser } from './relationship-contact-is-owned-by-user';
import { relationshipCreateIsAttachedToAny } from './relationship-create-is-attached-to-any';
import { relationshipFeedbackItemIsFeedbackForUser } from './relationship-feedback-item-is-feedback-for-user';
import { relationshipFirstTimeLoginIsAttachedToUser } from './relationship-first-time-login-is-attached-to-user';
import { relationshipGroupHasGroupMemberUser } from './relationship-group-has-group-member-user';
import { relationshipImprovementHasAttachedMilestone } from './relationship-improvement-has-attached-milestone';
import { relationshipImprovementHasDedicatedUserUser } from './relationship-improvement-has-dedicated-user-user';
import { relationshipImprovementIsAttachedToPattern } from './relationship-improvement-is-attached-to-pattern';
import { relationshipImprovementIsAttachedToProduct } from './relationship-improvement-is-attached-to-product';
import { relationshipImprovementIsContributedToByUser } from './relationship-improvement-is-contributed-to-by-user';
import { relationshipImprovementIsGuidedByUser } from './relationship-improvement-is-guided-by-user';
import { relationshipImprovementIsImplementedByProject } from './relationship-improvement-is-implemented-by-project';
import { relationshipImprovementIsOwnedByUser } from './relationship-improvement-is-owned-by-user';
import { relationshipLoopHasChannel } from './relationship-loop-has-channel';
import { relationshipLoopHasThread } from './relationship-loop-has-thread';
import { relationshipLoopHasSubLoop } from './relationship-loop-has-sub-loop';
import { relationshipMessageIsAttachedToAny } from './relationship-message-is-attached-to-any';
import { relationshipMilestoneIsOwnedByUser } from './relationship-milestone-is-owned-by-user';
import { relationshipMilestoneRequiresMilestone } from './relationship-milestone-requires-milestone';
import { relationshipNotificationIsAttachedToAny } from './relationship-notification-is-attached-to-any';
import { relationshipNotificationIsReadByUser } from './relationship-notification-is-read-by-user';
import { relationshipOpportunityHasBackupOwnerUser } from './relationship-opportunity-has-backup-owner-user';
import { relationshipOpportunityIsAttachedToAccount } from './relationship-opportunity-is-attached-to-account';
import { relationshipOpportunityIsOwnedByUser } from './relationship-opportunity-is-owned-by-user';
import { relationshipOrgHasThread } from './relationship-org-has-thread';
import { relationshipOrgHasLoop } from './relationship-org-has-loop';
import { relationshipPasswordResetIsAttachedToUser } from './relationship-password-reset-is-attached-to-user';
import { relationshipPatternIsAttachedToSalesThread } from './relationship-pattern-is-attached-to-sales-thread';
import { relationshipPatternIsAttachedToSupportThread } from './relationship-pattern-is-attached-to-support-thread';
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
import { relationshipThreadIsOfAny } from './relationship-thread-is-of-any';
import { relationshipUpdateIsAttachedToAny } from './relationship-update-is-attached-to-any';
import { relationshipUserHasAttachedContactContact } from './relationship-user-has-attached-contact-contact';
import { relationshipUserHasNotification } from './relationship-user-has-notification';
import { relationshipUserOwnsRating } from './relationship-user-owns-rating';
import { relationshipViewIsAttachedToChannel } from './relationship-view-is-attached-to-channel';
import { relationshipWhisperIsAttachedToAny } from './relationship-whisper-is-attached-to-any';
import { roleLoop } from './role-loop';
import { roleUserExternalSupport } from './role-user-external-support';
import { saga } from './saga';
import { salesThread } from './sales-thread';
import { subscription } from './subscription';
import { summary } from './summary';
import { supportThread } from './support-thread';
import { tag } from './tag';
import { thread } from './thread';
import { triggeredAction } from './triggered-action';
import { triggeredActionDirectMessageSubscription } from './triggered-action-direct-message-subscription';
import { triggeredActionIntegrationImportEvent } from './triggered-action-integration-import-event';
import { triggeredActionOrgCreationMembership } from './triggered-action-org-creation-membership';
import { triggeredActionSupportCompletedImprovementReopen } from './triggered-action-support-completed-improvement-reopen';
import { triggeredActionSupportReopen } from './triggered-action-support-reopen';
import { triggeredActionSupportSummary } from './triggered-action-support-summary';
import { triggeredActionSyncThreadPostLinkWhisper } from './triggered-action-sync-thread-post-link-whisper';
import { triggeredActionUpdateEventEditedAt } from './triggered-action-update-event-edited-at';
import { triggeredActionUserContact } from './triggered-action-user-contact';
import { update } from './update';
import { userGuest } from './user-guest';
import { userHubot } from './user-hubot';
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
import { viewAllViews } from './view-all-views';
import { viewCustomerSuccessSupportThreads } from './view-customer-success-support-threads';
import { viewMyConversations } from './view-my-conversations';
import { viewMyOpportunities } from './view-my-opportunities';
import { viewMyOrgs } from './view-my-orgs';
import { viewPaidSupportThreads } from './view-paid-support-threads';
import { viewSecuritySupportThreads } from './view-security-support-threads';
import { viewSupportThreadsParticipation } from './view-support-threads-participation';
import { viewWorkflows } from './view-workflows';
import { webPushSubscription } from './web-push-subscription';
import { whisper } from './whisper';
import { workflow } from './workflow';

export const contracts: ContractDefinition[] = [
	account,
	action,
	actionRequest,
	blogPost,
	brainstormCall,
	brainstormTopic,
	channel,
	checkin,
	contact,
	create,
	externalEvent,
	faq,
	feedbackItem,
	firstTimeLogin,
	group,
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
	relationshipBrainstormCallHasAttachedBrainstormTopic,
	relationshipBrainstormTopicHasAttachedImprovement,
	relationshipBrainstormTopicHasAttachedPattern,
	relationshipBrainstormTopicHasAttachedSalesThread,
	relationshipBrainstormTopicHasAttachedSupportThread,
	relationshipCheckinIsAttendedByUser,
	relationshipContactHasBackupOwnerUser,
	relationshipContactIsAttachedToUser,
	relationshipContactIsOwnedByUser,
	relationshipCreateIsAttachedToAny,
	relationshipFeedbackItemIsFeedbackForUser,
	relationshipFirstTimeLoginIsAttachedToUser,
	relationshipGroupHasGroupMemberUser,
	relationshipImprovementHasAttachedMilestone,
	relationshipImprovementHasDedicatedUserUser,
	relationshipImprovementIsAttachedToPattern,
	relationshipImprovementIsAttachedToProduct,
	relationshipImprovementIsContributedToByUser,
	relationshipImprovementIsGuidedByUser,
	relationshipImprovementIsImplementedByProject,
	relationshipImprovementIsOwnedByUser,
	relationshipLoopHasChannel,
	relationshipLoopHasThread,
	relationshipLoopHasSubLoop,
	relationshipMessageIsAttachedToAny,
	relationshipMilestoneIsOwnedByUser,
	relationshipMilestoneRequiresMilestone,
	relationshipNotificationIsAttachedToAny,
	relationshipNotificationIsReadByUser,
	relationshipOpportunityHasBackupOwnerUser,
	relationshipOpportunityIsAttachedToAccount,
	relationshipOpportunityIsOwnedByUser,
	relationshipOrgHasThread,
	relationshipOrgHasLoop,
	relationshipPasswordResetIsAttachedToUser,
	relationshipPatternIsAttachedToSalesThread,
	relationshipPatternIsAttachedToSupportThread,
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
	relationshipThreadIsOfAny,
	relationshipUpdateIsAttachedToAny,
	relationshipUserHasAttachedContactContact,
	relationshipUserHasNotification,
	relationshipUserOwnsRating,
	relationshipViewIsAttachedToChannel,
	relationshipWhisperIsAttachedToAny,
	roleLoop,
	roleUserExternalSupport,
	saga,
	salesThread,
	subscription,
	summary,
	supportThread,
	tag,
	thread,
	triggeredAction,
	triggeredActionDirectMessageSubscription,
	triggeredActionIntegrationImportEvent,
	triggeredActionOrgCreationMembership,
	triggeredActionSupportCompletedImprovementReopen,
	triggeredActionSupportReopen,
	triggeredActionSupportSummary,
	triggeredActionSyncThreadPostLinkWhisper,
	triggeredActionUpdateEventEditedAt,
	triggeredActionUserContact,
	update,
	userGuest,
	userHubot,
	viewActive,
	viewActiveTriggeredActions,
	viewAllJellyfishSupportThreads,
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
	viewPaidSupportThreads,
	viewSecuritySupportThreads,
	viewSupportThreadsParticipation,
	viewWorkflows,
	webPushSubscription,
	whisper,
	workflow,
];
