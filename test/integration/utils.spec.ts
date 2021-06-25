/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as helpers from './helpers';
import * as utils from '../../lib/utils';
import { v4 as uuidv4 } from 'uuid';

let context: helpers.IntegrationTestContext;

beforeAll(async () => {
	context = await helpers.before();
});

afterAll(() => {
	return helpers.after(context);
});

describe('.hasCard()', () => {
	test('id = yes (exists), slug = yes (exists)', async () => {
		const card = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasCard(context.context, context.jellyfish, context.session, {
				id: card.id,
				version: '1.0.0',
				slug: card.slug,
			}),
		).toBe(true);
	});

	test('id = yes (exists), slug = yes (not exist)', async () => {
		const card = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasCard(context.context, context.jellyfish, context.session, {
				id: card.id,
				version: '1.0.0',
				slug: context.generateRandomSlug(),
			}),
		).toBe(true);
	});

	test('id = yes (not exist), slug = yes (exists)', async () => {
		const card = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasCard(context.context, context.jellyfish, context.session, {
				id: uuidv4(),
				version: '1.0.0',
				slug: card.slug,
			}),
		).toBe(true);
	});

	test('id = yes (not exist), slug = yes (not exist)', async () => {
		expect(
			await utils.hasCard(context.context, context.jellyfish, context.session, {
				id: uuidv4(),
				version: '1.0.0',
				slug: context.generateRandomSlug(),
			}),
		).toBe(false);
	});

	test('id = no, slug = yes (exists)', async () => {
		const card = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasCard(context.context, context.jellyfish, context.session, {
				version: '1.0.0',
				slug: card.slug,
			} as any),
		).toBe(true);
	});

	test('id = no, slug = yes (not exist)', async () => {
		expect(
			await utils.hasCard(context.context, context.jellyfish, context.session, {
				version: '1.0.0',
				slug: context.generateRandomSlug(),
			} as any),
		).toBe(false);
	});
});
