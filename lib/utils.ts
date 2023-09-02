import { LogContext } from '@balena/jellyfish-logger';
import type { AutumnDBSession, Contract, JsonSchema, Kernel } from 'autumndb';
import iso8601Duration from 'iso8601-duration';
import { v4 as uuidv4 } from 'uuid';
import type { ActionContract } from '.';

/**
 * @summary Get the current timestamp
 * @function
 * @public
 *
 * @returns RFC 3339 timestamp
 *
 * @example
 * const timestamp = utils.getCurrentTimestamp();
 */
export const getCurrentTimestamp = (): string => {
	const currentDate = new Date();
	return currentDate.toISOString();
};

/**
 * @summary Get the arguments schema from an action contract
 * @function
 * @public
 *
 * @param actionContract - action contract
 * @returns arguments schema
 *
 * @example
 * const schema = utils.getActionArgumentsSchema({ ... });
 * console.log(schema.type);
 */
export const getActionArgumentsSchema = (
	actionContract: ActionContract,
): JsonSchema => {
	const argumentNames = Object.keys(actionContract.data.arguments);
	return argumentNames.length === 0
		? {
				type: 'object',
		  }
		: {
				type: 'object',
				properties: actionContract.data.arguments,
				additionalProperties: false,
				required: (actionContract.data.required as string[]) || argumentNames,
		  };
};

/**
 * @summary Check if a contract exists in the system
 * @function
 * @public
 *
 * @param logContext - log context
 * @param kernel - kernel instance
 * @param session - session id
 * @param object - contract properties
 * @returns whether the contract exists
 *
 * @example
 * const session = '4a962ad9-20b5-4dd8-a707-bf819593cc84';
 * const hasContract = await utils.hasContract({ ... }, kernel, session, {
 *   id: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
 *   active: true,
 *   data: {
 *     foo: 'bar',
 *   },
 * });
 *
 * if (hasContract) {
 *   console.log('This contract already exists');
 * }
 */
export const hasContract = async (
	logContext: LogContext,
	kernel: Kernel,
	session: AutumnDBSession,
	object: Pick<Contract, 'slug' | 'version' | 'id'>,
): Promise<boolean> => {
	if (
		object.id &&
		(await kernel.getContractById(logContext, session, object.id))
	) {
		return true;
	}

	if (
		object.slug &&
		(await kernel.getContractBySlug(
			logContext,
			session,
			`${object.slug}@${object.version}`,
		))
	) {
		return true;
	}

	return false;
};

/**
 * @summary Get the slug for an event
 * @function
 * @public
 *
 * @param {String} type - event type
 * @returns {String} slug
 *
 * @example
 * const slug = await utils.getEventSlug('execute')
 */
export const getEventSlug = (type: string): string => {
	return `${type}-${uuidv4()}`;
};

/**
 * @summary Convert an ISO 8601 duration to milliseconds
 * @function
 *
 * @param duration - the ISO 8601 duration (e.g. 'PT1H')
 * @returns the duration in milliseconds, or 0 if the duration is invalid
 */
export const durationToMs = (duration: string): number => {
	try {
		return iso8601Duration.toSeconds(iso8601Duration.parse(duration)) * 1000;
	} catch (err) {
		return 0;
	}
};

export const getQueryWithOptionalLinks = (
	object: { id?: string; slug?: string; version?: string },
	linkVerbs: string[] = [],
): JsonSchema => {
	const required = object.id ? ['id'] : ['slug', 'version'];
	const properties: { [key: string]: JsonSchema } = object.id
		? {
				id: {
					type: 'string',
					const: object.id,
				},
		  }
		: {
				slug: {
					type: 'string',
					const: object.slug,
				},
				version: {
					type: 'string',
					const: object.version,
				},
		  };
	return {
		type: 'object',
		description: 'Get contract with optional links',

		// All links will be optional
		anyOf: [
			true,
			...linkVerbs.map((linkVerb): JsonSchema => {
				return {
					$$links: {
						[linkVerb]: {
							type: 'object',
							additionalProperties: true,
						},
					},
				};
			}),
		],
		required,
		properties,
		additionalProperties: true,
	};
};
