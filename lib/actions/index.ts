import type { ActionDefinition } from '../plugin';
import { actionCreateCard } from './action-create-card';
import { actionCreateEvent } from './action-create-event';
import { actionCreateSession } from './action-create-session';
import { actionCreateUser } from './action-create-user';
import { actionMatchMakeTask } from './action-matchmake-task';
import { actionSetAdd } from './action-set-add';
import { actionUpdateCard } from './action-update-card';

export const actions: ActionDefinition[] = [
	actionCreateCard,
	actionCreateEvent,
	actionCreateSession,
	actionCreateUser,
	actionMatchMakeTask,
	actionSetAdd,
	actionUpdateCard,
];
