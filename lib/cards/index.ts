import { actionRequest } from './action-request';
import create from './create';
import { roleUserCommunity } from './role-user-community';
import { roleUserGuest } from './role-user-guest';
import { roleUserExternalSupport } from './role-user-external-support';
import { roleUserOperator } from './role-user-operator';
import { roleUserTest } from './role-user-test';
import triggeredAction from './triggered-action';
import update from './update';
import { viewAllViews } from './view-all-views';

// TS-TODO: Load these contracts from a model repo
export default {
	'action-request': actionRequest,
	create,
	'triggered-action': triggeredAction,
	'role-user-community': roleUserCommunity,
	'role-user-external-support': roleUserExternalSupport,
	'role-user-guest': roleUserGuest,
	'role-user-operator': roleUserOperator,
	'role-user-test': roleUserTest,
	update,
	'view-all-views': viewAllViews,
};
