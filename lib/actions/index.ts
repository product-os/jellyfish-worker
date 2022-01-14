import type { ActionDefinition } from '../plugin';
import type { Map } from '../types';
import { actionCreateCard } from './action-create-card';
import { actionCreateEvent } from './action-create-event';

export const actions: Map<ActionDefinition> = {
	'action-create-card': actionCreateCard,
	'action-create-event': actionCreateEvent,
};
