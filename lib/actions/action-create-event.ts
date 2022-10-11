import * as assert from '@balena/jellyfish-assert';
import { errors as coreErrors, TypeContract } from 'autumndb';
import * as _ from 'lodash';
import { WorkerNoElement } from '../errors';
import type { ActionDefinition } from '../plugin';

// Matches all multi-line and inline code blocks
const CODE_BLOCK_REGEXP = /`{1,3}[^`]*`{1,3}/g;

export const createPrefixRegExp = (prefix: string) => {
	const regExp = new RegExp(
		`(\\s|^)((${prefix})[a-z\\d-_\\/]+(\\.[a-z\\d-_\\/]+)*)`,
		'gmi',
	);
	return regExp;
};

/**
 * @summary match words prefixed with a specific value
 *
 * @param {String} prefix - The prefix used
 * @param {String} source - The text to analyse
 *
 * @returns {String[]} An array of matching strings
 */
export const findWordsByPrefix = (prefix: string, source: string) => {
	const regExp = createPrefixRegExp(prefix);
	return _.invokeMap(_.compact(source.match(regExp)), 'trim');
};

/**
 * @summary match keys using a prefix and map them to the keys themselves
 *
 * @param {String} prefix - The prefix used to indicate a key
 * @param {String} source - The text to analyse
 * @param {String} replacement - The string to replace the prefix with
 *
 * @returns {String[]} An array of matched keys
 */
export const getSlugsByPrefix = (
	prefix: string,
	source: string,
	replacement = '',
) => {
	const words = findWordsByPrefix(prefix, source);

	return _.uniq(
		words.map((name) => {
			return name.trim().replace(prefix, replacement);
		}),
	);
};

export const getMessageMetaData = (message: string) => {
	const sanitizedMessage = message.replace(CODE_BLOCK_REGEXP, '');
	return {
		mentionsUser: getSlugsByPrefix('@', sanitizedMessage, 'user-'),
		alertsUser: getSlugsByPrefix('!', sanitizedMessage, 'user-'),
		mentionsGroup: getSlugsByPrefix('@@', sanitizedMessage),
		alertsGroup: getSlugsByPrefix('!!', sanitizedMessage),
		tags: findWordsByPrefix('#', sanitizedMessage).map((tag) => {
			return tag.slice(1).toLowerCase();
		}),
	};
};

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	contract,
	request,
) => {
	const typeContract = context.cards[
		`${request.arguments.type}@1.0.0`
	] as TypeContract;
	assert.USER(
		request.logContext,
		typeContract,
		WorkerNoElement,
		`No such type: ${request.arguments.type}`,
	);

	// In most cases, the `card` argument will contain all the information we
	// need, but in some instances (for example when the guest user session
	// creates a new user), `card` will be missing certain fields due to
	// a permission filter being applied. The full contract is loaded using
	// a privileged sessions so that we can ensure all required fields are
	// present.
	const fullContract = (await context.getCardById(
		context.privilegedSession,
		contract.id,
	))!;

	let tags: string[] = [];
	let payload = request.arguments.payload;
	if (typeContract.slug === 'message' || typeContract.slug === 'whisper') {
		const metadata = getMessageMetaData(
			request.arguments.payload.message || '',
		);
		const { mentionsUser, alertsUser, mentionsGroup, alertsGroup } = metadata;

		tags = metadata.tags;
		payload = {
			mentionsUser,
			alertsUser,
			mentionsGroup,
			alertsGroup,
			...request.arguments.payload,
		};
	}

	const data = {
		timestamp: request.timestamp,
		target: fullContract.id,
		actor: request.actor,
		payload,
	};

	const result = (await context
		.insertCard(
			session,
			typeContract,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: false,
			},
			{
				slug: request.arguments.slug || context.getEventSlug(typeContract.slug),
				version: '1.0.0',
				name: request.arguments.name || null,
				tags: request.arguments.tags || tags,

				// Events always inherit the head contracts markers
				markers: fullContract.markers,
				data,
			},
		)
		.catch((error: unknown) => {
			// This is a user error
			if (error instanceof coreErrors.JellyfishElementAlreadyExists) {
				error.expected = true;
			}

			throw error;
		}))!;

	// Create a link card between the event and its target
	await context.insertCard(
		session,
		context.cards['link@1.0.0'] as TypeContract,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: false,
		},
		{
			slug: context.getEventSlug('link'),
			type: 'link@1.0.0',
			name: 'is attached to',
			data: {
				inverseName: 'has attached element',
				from: {
					id: result.id,
					type: result.type,
				},
				to: {
					id: fullContract.id,
					type: fullContract.type,
				},
			},
		},
	);

	if (!result) {
		return null;
	}

	return {
		id: result.id,
		type: result.type,
		version: result.version,
		slug: result.slug,
	};
};

export const actionCreateEvent: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-create-event',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Attach an event to a contract',
		data: {
			arguments: {
				tags: {
					type: 'array',
					items: {
						type: 'string',
					},
				},
				slug: {
					type: 'string',
					pattern: '^[a-z0-9-]+$',
				},
				name: {
					type: 'string',
				},
				type: {
					type: 'string',
					pattern: '^[a-z0-9-]+$',
				},
				payload: {
					type: 'object',
				},
			},
			required: ['type', 'payload'],
		},
	},
};
