import type { ActionDefinition } from '../plugin';
import { actionBootstrapChannel } from './action-bootstrap-channel';
import { actionBroadcast } from './action-broadcast';
import { actionCompleteFirstTimeLogin } from './action-complete-first-time-login';
import { actionCompletePasswordReset } from './action-complete-password-reset';
import { actionCreateCard } from './action-create-card';
import { actionCreateEvent } from './action-create-event';
import { actionCreateSession } from './action-create-session';
import { actionCreateUser } from './action-create-user';
import { actionDeleteCard } from './action-delete-card';
import { actionGoogleMeet } from './action-google-meet';
import { actionIncrement } from './action-increment';
import { actionIncrementTag } from './action-increment-tag';
import { actionInitializeAgent } from './action-initialize-agent';
import { actionIntegrationImportEvent } from './action-integration-import-event';
import { actionMaintainContact } from './action-maintain-contact';
import { actionMatchMake } from './action-matchmake';
import { actionMatchMakeTask } from './action-matchmake-task';
import { actionMergeDraftVersion } from './action-merge-draft-version';
import { actionOAuthAssociate } from './action-oauth-associate';
import { actionOAuthAuthorize } from './action-oauth-authorize';
import { actionPing } from './action-ping';
import { actionRequestPasswordReset } from './action-request-password-reset';
import { actionSendEmail } from './action-send-email';
import { actionSendFirstTimeLoginLink } from './action-send-first-time-login-link';
import { actionSetAdd } from './action-set-add';
import { actionSetPassword } from './action-set-password';
import { actionSetUpdate } from './action-set-update';
import { actionSetUserAvatar } from './action-set-user-avatar';
import { actionUpdateCard } from './action-update-card';

export const actions: ActionDefinition[] = [
	actionBootstrapChannel,
	actionBroadcast,
	actionCompleteFirstTimeLogin,
	actionCompletePasswordReset,
	actionCreateCard,
	actionCreateEvent,
	actionCreateSession,
	actionCreateUser,
	actionDeleteCard,
	actionGoogleMeet,
	actionIncrement,
	actionIncrementTag,
	actionInitializeAgent,
	actionIntegrationImportEvent,
	actionMaintainContact,
	actionMatchMake,
	actionMatchMakeTask,
	actionMergeDraftVersion,
	actionOAuthAssociate,
	actionOAuthAuthorize,
	actionPing,
	actionRequestPasswordReset,
	actionSendEmail,
	actionSendFirstTimeLoginLink,
	actionSetAdd,
	actionSetPassword,
	actionSetUpdate,
	actionSetUserAvatar,
	actionUpdateCard,
];
