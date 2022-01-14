import type { ActionFile, Map } from '../types';
import { actionCreateEvent } from './action-create-event';

export const actions: Map<ActionFile> = {
	'action-create-event': actionCreateEvent,
};
