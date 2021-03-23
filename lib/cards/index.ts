/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import triggeredAction from './triggered-action';
import create from './create';
import update from './update';

// TS-TODO: Load these contracts from a model repo
export default {
	create,
	update,
	'triggered-action': triggeredAction,
};
