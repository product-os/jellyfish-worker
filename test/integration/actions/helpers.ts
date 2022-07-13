import {
	ActionContractDefinition,
	ActionData,
	ActionHandlerRequest,
	ActionPreRequest,
	testUtils,
} from '../../../lib';
import { Kernel, testUtils as autumndbTestUtils } from 'autumndb';
import { v4 as uuidv4 } from 'uuid';

/**
 * @summary Generate and return an action request object
 * @function
 *
 * @param context - execution context
 * @param requestArguments - optional request arguments
 * @returns action request object
 */
export function makeRequest(
	context: testUtils.TestContext,
	requestArguments = {},
): any {
	// the return value gets abused as two different request objects...
	return {
		context: {
			id: `TEST-${uuidv4()}`,
		},
		timestamp: new Date().toISOString(),
		actor: context.adminUserId,
		originator: uuidv4(),
		arguments: requestArguments,
	};
}

export function makeHandlerRequest(
	context: testUtils.TestContext,
	actionContract: ActionContractDefinition,
	requestArguments = {},
): ActionHandlerRequest {
	const contract = {
		id: autumndbTestUtils.generateRandomId(),
		...Kernel.defaults<ActionData>(actionContract),
	};

	return {
		action: contract,
		card: contract.slug,
		epoch: null,
		logContext: {
			id: `TEST-${uuidv4()}`,
		},
		timestamp: new Date().toISOString(),
		actor: context.adminUserId,
		originator: uuidv4(),
		arguments: requestArguments,
	};
}

export function makePreRequest(
	context: testUtils.TestContext,
	actionContract: ActionContractDefinition,
	options: { card?: string; type?: string; requestArguments?: object } = {},
): ActionPreRequest {
	return {
		action: actionContract.slug,
		card: options.card || autumndbTestUtils.generateRandomId(),
		type: options.type || 'card@1.0.0',
		logContext: context.logContext,
		arguments: options.requestArguments || {},
	};
}

/**
 * Check that a given string exists within form data payload
 * @function
 *
 * @param key - parameter name to check for
 * @param value - value expected to be assigned to key
 * @param text - full form data payload
 * @returns boolean denoting if parameter information was found
 */
export function includes(key: string, value: string, text: string): boolean {
	const pattern = new RegExp(`name="${key}"\\s*${value}`, 'm');
	const regex = text.search(pattern);
	return regex !== -1;
}
