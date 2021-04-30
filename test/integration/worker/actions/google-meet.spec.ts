/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import helpers = require('../helpers');

const hasCredentials = () => {
	try {
		const cred = JSON.parse(environment.integration['google-meet'].credentials);
		return !_.isEmpty(cred);
	} catch (err) {
		return false;
	}
};

let ctx: helpers.IntegrationTestContext & { card: any };

// Skip all tests if there are no credentials
const jestTest =
	!hasCredentials() || environment.test.integration.skip ? it.skip : it;

beforeAll(async () => {
	ctx = await helpers.worker.before();

	// Create a card that we'll add a conferenceUrl to
	ctx.card = await ctx.jellyfish.insertCard(ctx.context, ctx.session, {
		type: 'card@1.0.0',
		slug: `card-${uuidv4()}`,
		version: '1.0.0',
		data: {},
	});
});

afterAll(() => {
	return helpers.worker.after(ctx);
});

describe('action-google-meet', () => {
	jestTest('should return a conference URL', async () => {
		const { session, context, card, processAction } = ctx;

		const result = await processAction(session, {
			action: 'action-google-meet@1.0.0',
			context,
			card: card.id,
			type: card.type,
			arguments: {},
		});

		expect(
			result.data.conferenceUrl.startsWith('https://meet.google.com'),
		).toBe(true);
	});

	jestTest('should update the card with the conference URL', async () => {
		const { session, context, card, jellyfish, processAction } = ctx;

		await processAction(session, {
			action: 'action-google-meet@1.0.0',
			context,
			card: card.id,
			type: card.type,
			arguments: {},
		});

		const [updatedCard] = await jellyfish.query(context, session, {
			type: 'object',
			required: ['id', 'type'],
			additionalProperties: true,
			properties: {
				type: {
					type: 'string',
					const: card.type,
				},
				id: {
					type: 'string',
					const: card.id,
				},
			},
		});

		expect(
			(updatedCard.data as any).conferenceUrl.startsWith(
				'https://meet.google.com',
			),
		).toBe(true);
	});
});
