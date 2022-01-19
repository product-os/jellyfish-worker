import { create } from './create';
import { roleUserCommunity } from './role-user-community';
import { roleUserExternalSupport } from './role-user-external-support';
import { roleUserOperator } from './role-user-operator';
import { roleUserTest } from './role-user-test';
import { scheduledAction } from './scheduled-action';
import { triggeredAction } from './triggered-action';
import { update } from './update';
import { viewAllViews } from './view-all-views';

// TS-TODO: Load these contracts from a model repo
export default {
	create,
	'triggered-action': triggeredAction,
	'role-user-community': roleUserCommunity,
	'role-user-external-support': roleUserExternalSupport,
	'role-user-operator': roleUserOperator,
	'role-user-test': roleUserTest,
	'scheduled-action': scheduledAction,
	update,
	'view-all-views': viewAllViews,
};
