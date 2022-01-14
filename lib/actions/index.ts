import type { ActionDefinition } from '../plugin';
import type { Map } from '../types';
import { actionCreateEvent } from './action-create-event';

export const actions: Map<ActionDefinition> = {
	'action-create-event': actionCreateEvent,
};
