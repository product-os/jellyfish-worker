import { ActionLibrary } from '@balena/jellyfish-action-library';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { Worker } from '../../lib';
import * as utils from '../../lib/utils';

let context: integrationHelpers.IntegrationTestContext;

beforeAll(async () => {
	context = await integrationHelpers.before({
		plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin],
		worker: Worker,
	});
});

afterAll(() => {
	return integrationHelpers.after(context);
});

describe('.hasCard()', () => {
	test('id = yes (exists), slug = yes (exists)', async () => {
		const card = await context.kernel.insertCard(
			context.logContext,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasCard(context.logContext, context.kernel, context.session, {
				id: card.id,
				version: '1.0.0',
				slug: card.slug,
			}),
		).toBe(true);
	});

	test('id = yes (exists), slug = yes (not exist)', async () => {
		const card = await context.kernel.insertCard(
			context.logContext,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasCard(context.logContext, context.kernel, context.session, {
				id: card.id,
				version: '1.0.0',
				slug: context.generateRandomSlug(),
			}),
		).toBe(true);
	});

	test('id = yes (not exist), slug = yes (exists)', async () => {
		const card = await context.kernel.insertCard(
			context.logContext,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasCard(context.logContext, context.kernel, context.session, {
				id: context.generateRandomID(),
				version: '1.0.0',
				slug: card.slug,
			}),
		).toBe(true);
	});

	test('id = yes (not exist), slug = yes (not exist)', async () => {
		expect(
			await utils.hasCard(context.logContext, context.kernel, context.session, {
				id: context.generateRandomID(),
				version: '1.0.0',
				slug: context.generateRandomSlug(),
			}),
		).toBe(false);
	});

	test('id = no, slug = yes (exists)', async () => {
		const card = await context.kernel.insertCard(
			context.logContext,
			context.session,
			{
				slug: context.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasCard(context.logContext, context.kernel, context.session, {
				version: '1.0.0',
				slug: card.slug,
			} as any),
		).toBe(true);
	});

	test('id = no, slug = yes (not exist)', async () => {
		expect(
			await utils.hasCard(context.logContext, context.kernel, context.session, {
				version: '1.0.0',
				slug: context.generateRandomSlug(),
			} as any),
		).toBe(false);
	});
});
