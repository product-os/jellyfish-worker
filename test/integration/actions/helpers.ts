import * as uuid from 'uuid';
import type { testUtils } from '../../../lib';

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
			id: `TEST-${uuid.v4()}`,
		},
		timestamp: new Date().toISOString(),
		actor: context.adminUserId,
		originator: uuid.v4(),
		arguments: requestArguments,
	};
}
