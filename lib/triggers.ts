/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import _ from 'lodash';
import jsone from 'json-e';
import skhema from 'skhema';
import * as assert from '@balena/jellyfish-assert';
import { JSONSchema, core, worker } from '@balena/jellyfish-types';
import * as errors from './errors';
import * as utils from './utils';
import { LogContext, JellyfishKernel } from './types';

interface CompileContext {
	timestamp: string;
	epoch: number;
	matchRE: (
		pattern: string | RegExp,
		flags: string | undefined,
		str: string,
	) => RegExpMatchArray;
	source?: core.Contract;
}

interface GetRequestOptions {
	currentDate: Date;
	mode?: 'update' | 'insert';
	context: LogContext;
	session: string;
}

export const matchesCard = async (
	context: LogContext,
	jellyfish: JellyfishKernel,
	session: string,
	filter: JSONSchema,
	card: core.Contract | null,
) => {
	if (!card) {
		return false;
	}

	// TS-TODO: Change the Skhema module to accept interfaces that extend JSONSchema
	const isValid = skhema.isValid(filter as any, card);
	const isLink = card.type.split('@')[0] === 'link';

	/*
	 * We don't discard triggers that didn't match the card
	 * right away as if a trigger uses links, then we also need
	 * to consider how new link cards impact the trigger.
	 *
	 * Consider cards A and B and a trigger that detects whether
	 * A is linked to B. If A is created and then linked to B
	 * at some time in the future, then we need to execute
	 * the trigger when the corresponding link card is created.
	 */
	if (!isValid && !isLink) {
		return false;
	}

	/*
	 * If the triggered action filter doesn't use any link,
	 * then its validity depends on whether it matches
	 * against the card or not.
	 */
	if (!filter || !filter.$$links) {
		return isValid ? card : false;
	}

	/*
	 * If we get to this point then it means that the triggered
	 * action filter contains links, so we will need to run
	 * a query to figure out if the filter is satisfied or not.
	 *
	 * The idea is that we can extend the trigger schema adding
	 * the id of the card we expect to find and execute it as
	 * a database query. If there is one result, then it means
	 * the trigger is satisfied.
	 */

	// So that we don't modify the object
	const schema = _.cloneDeep(filter);

	// We need the full card so we pass it to the trigger
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
	 * schema with the right card id. The challenge is that
	 * we need to consider link cards, and use the id from
	 * the right direction of the link depending on the
	 * link name in the trigger schema.
	 */
	if (isLink) {
		const linkContract: core.LinkContract = card as core.LinkContract;
		const linkType = Object.keys(schema.$$links!)[0];
		if (linkType === card.name) {
			schema.properties.id.const = linkContract.data.from.id;
		} else if (linkType === card.data.inverseName) {
			schema.properties.id.const = linkContract.data.to.id;

			// Abort if the link doesn't match.
		} else {
			return false;
		}
	} else {
		schema.properties.id.const = card.id;
	}

	// Run the query
	return _.first(
		await jellyfish.query(context, session, schema, {
			limit: 1,
		}),
	);
};

/**
 * @summary Compile the trigger data
 * @function
 * @private
 *
 * @param {Object} trigger - trigger
 * @param {String} trigger.card - card id
 * @param {Object} trigger.arguments - arguments
 * @param {(Object|Null)} card - card
 * @param {Date} currentDate - current date
 * @returns {Object} compiled data
 *
 * @example
 * const data = compileTrigger({ ... }, { ... }, new Date())
 * if (data) {
 *   console.log(data.card)
 *   console.log(data.arguments)
 * }
 */
const compileTrigger = (
	trigger: string | Record<any, any>,
	card: core.Contract | null,
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

	if (card) {
		context.source = card;
	}

	try {
		return jsone(trigger, context);
	} catch (error) {
		if (error.name === 'InterpreterError') {
			return null;
		}

		throw error;
	}
};

/**
 * @summary Get a request from a trigger
 * @function
 * @public
 *
 * @param {Object} jellyfish - jellyfish instance
 * @param {Object} trigger - trigger
 * @param {Object} trigger.filter - filter
 * @param {String} trigger.action - action slug
 * @param {String} trigger.card - card id
 * @param {Object} trigger.arguments - arguments
 * @param {Object} card - card
 * @param {Object} options - options
 * @param {String} options.mode - change type
 * @param {String} options.session - session
 * @param {Date} options.currentDate - current date
 * @param {Object} options.context - execution context
 * @returns {(Object|Null)} request, or null if error
 *
 * @example
 * const request = await triggers.getRequest(jellyfish, { ... }, { ... }, {
 *   currentDate: new Date(),
 *   mode: 'update',
 *   session: '4a962ad9-20b5-4dd8-a707-bf819593cc84'
 * }
 *
 * console.log(request.action)
 * console.log(request.arguments)
 * console.log(request.originator)
 * console.log(request.card)
 */
export const getRequest = async (
	jellyfish: JellyfishKernel,
	trigger: {
		filter: any;
		mode: any;
		arguments: any;
		target: any;
		action: any;
		id: any;
	},
	// If getRequest is called by a time triggered action, then card will be null
	card: core.Contract | null,
	options: GetRequestOptions,
) => {
	const match = await matchesCard(
		options.context,
		jellyfish,
		options.session,
		trigger.filter,
		card,
	);
	if (card && !match) {
		return null;
	}

	if (trigger.mode && trigger.mode !== options.mode) {
		return null;
	}

	// We are not interested in compiling the rest of
	// the properties, and skipping them here means that
	// the templating engine will be a bit faster
	const compiledTrigger = compileTrigger(
		{
			arguments: trigger.arguments,
			target: trigger.target,
		},
		match || card,
		options.currentDate,
	);

	if (!compiledTrigger) {
		return null;
	}

	return {
		action: trigger.action,
		arguments: compiledTrigger.arguments,
		originator: trigger.id,
		context: options.context,
		currentDate: options.currentDate,
		card: compiledTrigger.target,
	};
};

/**
 * @summary Get all triggered actions associated with a type
 * @function
 * @public
 *
 * @param {Object} context - execution context
 * @param {Object} jellyfish - jellyfish instance
 * @param {String} session - session id
 * @param {String} type - type slug
 * @returns {Object[]} triggered actions
 *
 * @example
 * const session = '4a962ad9-20b5-4dd8-a707-bf819593cc84'
 * const cards = await triggers.getTypeTriggers({ ... }, { ... }, session, 'user')
 *
 * for (const card of cards) {
 *   console.log(card)
 * }
 */
export const getTypeTriggers = async (
	context: LogContext,
	jellyfish: JellyfishKernel,
	session: string,
	type: string,
): Promise<worker.TriggeredActionContract[]> => {
	return jellyfish.query<worker.TriggeredActionContract>(context, session, {
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

				// We only want to consider cards that act based on a filter
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
 * @param {Object} trigger - triggered action card
 * @returns {Date} start date
 *
 * @example
 * const date = triggers.getStartDate({
 *   type: 'triggered-action',
 *   data: { ... }
 * })
 *
 * console.log(date.toISOString())
 */
export const getStartDate = (trigger: {
	data: { startDate?: string | number | Date };
}): Date => {
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
 * @param {Object} trigger - triggered action card
 * @param {Date} lastExecutionDate - last execution date
 * @returns {(Date|Null)} next execution date, if any
 *
 * @example
 * const nextExecutionDate = triggers.getNextExecutionDate({ ... }, new Date())
 * if (nextExecutionDate) {
 *   console.log(nextExecutionDate.toISOString())
 * }
 */
// TS-TODO: Detangle all the different structures that triggers can be in
export const getNextExecutionDate = (
	trigger: { data: { interval: string; startDate: string | number | Date } },
	lastExecutionDate: Date,
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
