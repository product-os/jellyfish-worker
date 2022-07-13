import * as assert from '@balena/jellyfish-assert';
import { getLogger } from '@balena/jellyfish-logger';
import type { TypeContract } from 'autumndb';
import axios from 'axios';
import md5 from 'blueimp-md5';
import { get, isNil } from 'lodash';
import { ActionDefinition, errors } from '../';

const logger = getLogger(__filename);
export const GRAVATAR_URL = 'https://www.gravatar.com/avatar/';

/**
 * Generate Gravatar URL given an email address
 * @function
 *
 * @param email - email address to generate URL from
 * @returns Gravatar URL
 */
export function generateURL(email: string): string {
	return `${GRAVATAR_URL + md5(email.trim())}?d=404`;
}

/**
 * Send a HEAD request to check if the avatar exists
 * @function
 *
 * @param url - Gravatar URL to check
 * @returns result denoting existence of avatar
 */
export async function gravatarExists(url: string): Promise<boolean> {
	try {
		await axios.head(url);
		return true;
	} catch (error) {
		return false;
	}
}

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const email = get(card, ['data', 'email']);

	// If a gravatar value is already set or the user has no email, exit early
	if (!email || !isNil(get(card, ['data', 'avatar']))) {
		return {
			id: card.id,
			slug: card.slug,
			version: card.version,
			type: card.type,
		};
	}

	// Check for valid Gravatar URL using all emails, set user avatar if possible
	const patch: any[] = [];
	const emails = Array.isArray(email) ? email : [email];
	for (const item of emails) {
		const url = generateURL(item);
		if (await gravatarExists(url)) {
			patch.push({
				op: 'add',
				path: '/data/avatar',
				value: url,
			});
			break;
		}
	}

	// Set avatar to null if no valid Gravatar URLs were found
	if (patch.length < 1) {
		patch.push({
			op: 'add',
			path: '/data/avatar',
			value: null,
		});
	}

	const typeCard = (await context.getCardBySlug(
		session,
		'user@1.0.0',
	))! as TypeContract;

	assert.INTERNAL(
		request.logContext,
		typeCard,
		errors.WorkerNoElement,
		'No such type: user',
	);

	logger.info(request.logContext, 'Patching user avatar', {
		slug: card.slug,
		patch,
	});

	await context.patchCard(
		session,
		typeCard,
		{
			timestamp: request.timestamp,
			reason: 'Updated user avatar',
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		card,
		patch,
	);

	return {
		id: card.id,
		slug: card.slug,
		version: card.version,
		type: card.type,
	};
};

export const actionSetUserAvatar: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-set-user-avatar',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Set the avatar url for a user',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'user@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {},
		},
	},
};
