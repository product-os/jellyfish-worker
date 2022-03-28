import * as assert from '@balena/jellyfish-assert';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type { JsonSchema } from '@balena/jellyfish-types';
import type {
	Contract,
	LinkContract,
} from '@balena/jellyfish-types/build/core';
import type { Kernel } from 'autumndb';
import jsone = require('json-e');
import _ from 'lodash';
import * as skhema from 'skhema';
import * as errors from './errors';
import type { TriggeredActionContract } from './types';
import * as utils from './utils';

const logger = getLogger('worker-triggers');

interface CompileContext {
	timestamp: string;
	epoch: number;
	matchRE: (
		pattern: string | RegExp,
		flags: string | undefined,
		str: string,
	) => RegExpMatchArray;
	source?: Contract;
}

interface GetRequestOptions {
	currentDate: Date;
	mode?: 'update' | 'insert';
	logContext: LogContext;
	session: string;
}

export const matchesContract = async (
	logContext: LogContext,
	kernel: Kernel,
	session: string,
	filter: JsonSchema,
	contract: Contract | null,
): Promise<Contract | false | void> => {
	if (!contract) {
		return false;
	}

	// TS-TODO: Change the Skhema module to accept interfaces that extend JsonSchema
	const isValid = skhema.isValid(filter as any, contract);
	const isLink = contract.type.split('@')[0] === 'link';

	/*
	 * We don't discard triggers that didn't match the contract
	 * right away as if a trigger uses links, then we also need
	 * to consider how new link contracts impact the trigger.
	 *
	 * Consider contracts A and B and a trigger that detects whether
	 * A is linked to B. If A is created and then linked to B
	 * at some time in the future, then we need to execute
	 * the trigger when the corresponding link contract is created.
	 */
	if (!isValid && !isLink) {
		return false;
	}

	/*
	 * If the triggered action filter doesn't use any link,
	 * then its validity depends on whether it matches
	 * against the contract or not.
	 */
	if (!filter || !(filter instanceof Object && filter.$$links)) {
		return isValid ? contract : false;
	}

	/*
	 * If we get to this point then it means that the triggered
	 * action filter contains links, so we will need to run
	 * a query to figure out if the filter is satisfied or not.
	 *
	 * The idea is that we can extend the trigger schema adding
	 * the id of the contract we expect to find and execute it as
	 * a database query. If there is one result, then it means
	 * the trigger is satisfied.
	 */

	// So that we don't modify the object
	const schema = _.cloneDeep(filter);

	// We need the full contract so we pass it to the trigger
	// templating engine
	schema.additionalProperties = true;

	if (!schema.required) {
		schema.required = [];
	}
	if (!schema.properties) {
		schema.properties = {};
	}
	schema.required.push('id', 'links');
	schema.properties.id = {
		type: 'string',
	};

	// Expand links so they are available from the
	// templating engine.
	schema.properties.links = {
		type: 'object',
		additionalProperties: true,
	};

	/*
	 * This is the tricky part, where we augment the trigger
	 * schema with the right contract id. The challenge is that
	 * we need to consider link contracts, and use the id from
	 * the right direction of the link depending on the
	 * link name in the trigger schema.
	 */
	if (isLink) {
		const linkContract: LinkContract = contract as LinkContract;
		const linkType = Object.keys(schema.$$links!)[0];
		if (linkType === contract.name) {
			schema.properties.id.const = linkContract.data.from.id;
		} else if (linkType === contract.data.inverseName) {
			schema.properties.id.const = linkContract.data.to.id;

			// Abort if the link doesn't match.
		} else {
			return false;
		}
	} else {
		schema.properties.id.const = contract.id;
	}

	// Run the query
	return _.first(
		await kernel.query(logContext, session, schema, {
			limit: 1,
		}),
	);
};

/**
 * @summary Compile the trigger data
 * @function
 * @private
 *
 * @param trigger - trigger
 * @param contract - trigger contract
 * @param currentDate - current date
 * @returns compiled data
 *
 * @example
 * const data = compileTrigger({ ... }, { ... }, new Date());
 * if (data) {
 *   console.log(data.card);
 *   console.log(data.arguments);
 * }
 */
const compileTrigger = (
	trigger: string | Record<any, any>,
	contract: Contract | null,
	currentDate: Date,
) => {
	const context: CompileContext = {
		timestamp: currentDate.toISOString(),
		epoch: currentDate.valueOf(),
		matchRE: (
			pattern: string | RegExp,
			flags: string | undefined,
			str: string,
		) => {
			const regEx = flags ? new RegExp(pattern, flags) : new RegExp(pattern);
			const match = str.match(regEx);
			return match || [];
		},
	};

	if (contract) {
		context.source = contract;
	}

	try {
		return jsone(trigger, context);
	} catch (error: any) {
		if (error.name === 'InterpreterError') {
			return null;
		}

		throw error;
	}
};

/**
 * @summary Create an action request from a trigger, if it matches, it didn't match before
 * 					or one of its fields listed in triggerPaths was changed
 * @function
 * @public
 *
 * @param kernel - kernel instance
 * @param trigger - triggered action contract
 * @param oldContract - contract before the change was applied (null if contract is new)
 * @param newContract - contract after the change was applied
 * @param options - options
 * @returns action request, or null if the trigger doesn't match
 */
export const getRequest = async (
	kernel: Kernel,
	trigger: TriggeredActionContract,
	// If getRequest is called by a time triggered action, then contract will be null
	oldContract: Contract | null,
	newContract: Contract,
	options: GetRequestOptions,
) => {
	if (trigger.data.mode && trigger.data.mode !== options.mode) {
		return null;
	}

	const newContractMatches = await matchesContract(
		options.logContext,
		kernel,
		options.session,
		trigger.data.filter!,
		newContract,
	);

	if (!newContractMatches) {
		return null;
	}

	if (oldContract) {
		const triggerPaths = findUsedPropertyPaths(trigger.data.filter!);
		const triggerPathsChanged = triggerPaths.some(
			(p) => !_.isEqual(_.get(oldContract, p), _.get(newContract, p)),
		);

		if (!triggerPathsChanged) {
			const { id, slug, version } = newContract;
			logger.info(
				options.logContext,
				'Ignoring matching trigger because match-state did not change',
				{ id, slug, version, triggerPaths },
			);
			return null;
		}
	}

	// We are not interested in compiling the rest of
	// the properties, and skipping them here means that
	// the templating engine will be a bit faster
	const compiledTrigger = compileTrigger(
		{
			arguments: trigger.data.arguments,
			target: trigger.data.target,
		},
		newContractMatches || newContract,
		options.currentDate,
	);

	if (!compiledTrigger) {
		return null;
	}

	return {
		action: trigger.data.action,
		arguments: compiledTrigger.arguments,
		originator: trigger.id,
		logContext: options.logContext,
		currentDate: options.currentDate,
		card: compiledTrigger.target,
	};
};

/**
 * @summary Get all triggered actions associated with a type
 * @function
 * @public
 *
 * @param logContext - execution context
 * @param kernel - kernel instance
 * @param session - session id
 * @param type - type slug
 * @returns triggered actions
 *
 * @example
 * const session = '4a962ad9-20b5-4dd8-a707-bf819593cc84';
 * const contracts = await triggers.getTypeTriggers({ ... }, { ... }, session, 'user');
 *
 * for (const contract of contracts) {
 *   console.log(contract);
 * }
 */
export const getTypeTriggers = async (
	logContext: LogContext,
	kernel: Kernel,
	session: string,
	type: string,
): Promise<TriggeredActionContract[]> => {
	return kernel.query<TriggeredActionContract>(logContext, session, {
		type: 'object',
		additionalProperties: true,
		required: ['id', 'version', 'active', 'type', 'data'],
		properties: {
			id: {
				type: 'string',
			},
			version: {
				type: 'string',
			},
			active: {
				type: 'boolean',
				const: true,
			},
			type: {
				type: 'string',
				const: 'triggered-action@1.0.0',
			},
			data: {
				type: 'object',
				additionalProperties: true,

				// We only want to consider contracts that act based on a filter
				required: ['type', 'filter'],

				properties: {
					type: {
						type: 'string',
						const: type,
					},
					filter: {
						type: 'object',
						additionalProperties: true,
					},
				},
			},
		},
	});
};

/**
 * @summary Get the start date of a triggered action
 * @function
 * @public
 *
 * @description
 * The start date determines when the triggered action should
 * start taking effect.
 * This function defaults to epoch if there is no start date.
 *
 * @param trigger - triggered action contract
 * @returns start date
 *
 * @example
 * const date = triggers.getStartDate({
 *   type: 'triggered-action',
 *   data: { ... },
 * });
 *
 * console.log(date.toISOString());
 */
export const getStartDate = (trigger: TriggeredActionContract): Date => {
	if (trigger && trigger.data && trigger.data.startDate) {
		const date = new Date(trigger.data.startDate);

		// Detect if the parsed date object is valid
		if (!isNaN(date.getTime())) {
			return date;
		}
	}

	// The oldest possible date
	return new Date('1970-01-01Z00:00:00:000');
};

/**
 * @summary Get the next execution date for a trigger
 * @function
 * @public
 *
 * @param trigger - triggered action contract
 * @param lastExecutionDate - last execution date
 * @returns next execution date, if any
 *
 * @example
 * const nextExecutionDate = triggers.getNextExecutionDate({ ... }, new Date());
 * if (nextExecutionDate) {
 *   console.log(nextExecutionDate.toISOString());
 * }
 */
export const getNextExecutionDate = (
	trigger: TriggeredActionContract,
	lastExecutionDate?: Date,
): Date | null => {
	if (!trigger || !trigger.data || !trigger.data.interval) {
		return null;
	}

	const startDate = getStartDate(trigger);
	if (
		!lastExecutionDate ||
		!_.isDate(lastExecutionDate) ||
		isNaN(lastExecutionDate.getTime())
	) {
		return startDate;
	}

	// The interval should be an ISO 8601 duration string, like PT1H
	const duration = utils.durationToMs(trigger.data.interval);
	assert.INTERNAL(
		null,
		duration !== 0,
		errors.WorkerInvalidDuration,
		`Invalid interval: ${trigger.data.interval}`,
	);

	const intervals = Math.floor(
		Math.abs(lastExecutionDate.getTime() - startDate.getTime()) / duration,
	);
	const times =
		lastExecutionDate >= startDate || intervals === 0 ? intervals + 1 : 0;
	return new Date(startDate.getTime() + duration * times);
};

/**
 * Parses a JSON schema object for all properties which might be accessed as part of a match
 *
 * @param schema JSON schema object to parse
 * @returns the list of referenced property paths
 */
export function findUsedPropertyPaths(schema: any): string[] {
	if (typeof schema !== 'object') {
		return [];
	}
	const result: string[] = [];
	for (const key of Object.keys(schema)) {
		if (key === '$$links') {
			continue;
		}
		if (key !== 'properties') {
			result.push(...findUsedPropertyPaths(schema[key]));
			continue;
		}
		for (const prop of Object.keys(schema.properties)) {
			const paths = findUsedPropertyPaths(schema.properties[prop]);
			if (paths.length > 0) {
				result.push(...paths.map((p) => `${prop}.${p}`));
			} else {
				result.push(prop);
			}
		}
	}
	return result;
}
