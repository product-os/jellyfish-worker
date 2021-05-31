/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import iso8601Duration from 'iso8601-duration';
import { v4 as uuidv4 } from 'uuid';
import * as _ from 'lodash';
import { getLogger } from '@balena/jellyfish-logger';
import { JSONSchema, core } from '@balena/jellyfish-types';
import { LogContext, JellyfishKernel } from './types';

const logger = getLogger('worker');

/**
 * @summary Get the current timestamp
 * @function
 * @public
 *
 * @returns {String} RFC 3339 timestamp
 *
 * @example
 * const timestamp = utils.getCurrentTimestamp()
 */
export const getCurrentTimestamp = (): string => {
	const currentDate = new Date();
	return currentDate.toISOString();
};

/**
 * @summary Get the arguments schema from an action card
 * @function
 * @public
 *
 * @param {Object} actionCard - action card
 * @returns {Object} arguments schema
 *
 * @example
 * const schema = utils.getActionArgumentsSchema({ ... })
 * console.log(schema.type)
 */
export const getActionArgumentsSchema = (
	actionCard: core.ActionContract,
): JSONSchema => {
	const argumentNames = Object.keys(actionCard.data.arguments);
	return argumentNames.length === 0
		? {
				type: 'object',
		  }
		: {
				type: 'object',
				properties: actionCard.data.arguments,
				additionalProperties: false,
				required: (actionCard.data.required as string[]) || argumentNames,
		  };
};

/**
 * @summary Check if a card exists in the system
 * @function
 * @public
 *
 * @param {Object} context - execution context
 * @param {Object} jellyfish - jellyfish instance
 * @param {String} session - session id
 * @param {Object} object - card properties
 * @returns {Boolean} whether the card exists
 *
 * @example
 * const session = '4a962ad9-20b5-4dd8-a707-bf819593cc84'
 * const hasCard = await utils.hasCard({ ... }, jellyfish, session, {
 *   id: 'a13474e4-7b44-453b-9f3e-aa783b8f37ea',
 *   active: true,
 *   data: {
 *     foo: 'bar'
 *   }
 * })
 *
 * if (hasCard) {
 *   console.log('This card already exists')
 * }
 */
export const hasCard = async (
	context: LogContext,
	jellyfish: JellyfishKernel,
	session: string,
	object: Pick<core.Contract, 'slug' | 'version' | 'id'>,
): Promise<boolean> => {
	if (object.id && (await jellyfish.getCardById(context, session, object.id))) {
		return true;
	}

	if (
		object.slug &&
		(await jellyfish.getCardBySlug(
			context,
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
export const getEventSlug = async (type: string): Promise<string> => {
	const id = uuidv4();
	return `${type}-${id}`;
};

/**
 * @summary Convert an ISO 8601 duration to milliseconds
 * @param {String} duration - the ISO 8601 duration (e.g. 'PT1H')
 * @returns {Number} - the duration in milliseconds, or 0 if the duration is invalid
 */
export const durationToMs = (duration: string): number => {
	try {
		return iso8601Duration.toSeconds(iso8601Duration.parse(duration)) * 1000;
	} catch (err) {
		return 0;
	}
};

export const getActorKey = async (
	context: LogContext,
	jellyfish: JellyfishKernel,
	session: string,
	actorId: string,
) => {
	const keySlug = `session-action-${actorId}`;
	const key = await jellyfish.getCardBySlug(
		context,
		session,
		`${keySlug}@1.0.0`,
	);

	if (key && key.data.actor === actorId) {
		return key;
	}

	logger.info(context, 'Create worker key', {
		slug: keySlug,
		actor: actorId,
	});

	return jellyfish.replaceCard(
		context,
		session,
		jellyfish.defaults({
			slug: keySlug,
			version: '1.0.0',
			type: 'session@1.0.0',
			data: {
				actor: actorId,
			},
		}),
	);
};

export const getQueryWithOptionalLinks = (
	object: { id?: string; slug?: string; version?: string },
	linkVerbs: string[] = [],
): JSONSchema => {
	const required = object.id ? ['id'] : ['slug', 'version'];
	const properties: { [key: string]: JSONSchema } = object.id
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
		description: 'Get card with optional links',

		// All links will be optional
		anyOf: [
			true,
			...linkVerbs.map((linkVerb) => {
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
