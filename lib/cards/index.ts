import create from './create';
import triggeredAction from './triggered-action';
import update from './update';

// TS-TODO: Load these contracts from a model repo
export default {
	create,
	update,
	'triggered-action': triggeredAction,
};
