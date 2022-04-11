import type { ActionDefinition } from '../plugin';
import type { Map } from '../types';
import { actionCreateCard } from './action-create-card';
import { actionCreateEvent } from './action-create-event';
import { actionCreateSession } from './action-create-session';
import { actionCreateUser } from './action-create-user';
import { actionMatchMakeTask } from './action-matchmake-task';
import { actionSetAdd } from './action-set-add';
import { actionUpdateCard } from './action-update-card';

export const actions: Map<ActionDefinition> = {
	'action-create-card': actionCreateCard,
	'action-create-event': actionCreateEvent,
	'action-create-session': actionCreateSession,
	'action-create-user': actionCreateUser,
	'action-matchmake-task': actionMatchMakeTask,
	'action-set-add': actionSetAdd,
	'action-update-card': actionUpdateCard,
};
