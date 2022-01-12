import { ActionLibrary } from '@balena/jellyfish-action-library';
import { cardMixins, testUtils as coreTestUtils } from '@balena/jellyfish-core';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import * as utils from '../../lib/utils';
import { testUtils } from '../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext({
		plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin],
		mixins: cardMixins,
	});
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('.hasCard()', () => {
	test('id = yes (exists), slug = yes (exists)', async () => {
		const card = await ctx.kernel.insertCard(ctx.logContext, ctx.session, {
			slug: coreTestUtils.generateRandomSlug(),
			type: 'card@1.0.0',
			version: '1.0.0',
		});

		expect(
			await utils.hasCard(ctx.logContext, ctx.kernel, ctx.session, {
				id: card.id,
				version: '1.0.0',
				slug: card.slug,
			}),
		).toBe(true);
	});

	test('id = yes (exists), slug = yes (not exist)', async () => {
		const card = await ctx.kernel.insertCard(ctx.logContext, ctx.session, {
			slug: coreTestUtils.generateRandomSlug(),
			type: 'card@1.0.0',
			version: '1.0.0',
		});

		expect(
			await utils.hasCard(ctx.logContext, ctx.kernel, ctx.session, {
				id: card.id,
				version: '1.0.0',
				slug: coreTestUtils.generateRandomSlug(),
			}),
		).toBe(true);
	});

	test('id = yes (not exist), slug = yes (exists)', async () => {
		const card = await ctx.kernel.insertCard(ctx.logContext, ctx.session, {
			slug: coreTestUtils.generateRandomSlug(),
			type: 'card@1.0.0',
			version: '1.0.0',
		});

		expect(
			await utils.hasCard(ctx.logContext, ctx.kernel, ctx.session, {
				id: coreTestUtils.generateRandomId(),
				version: '1.0.0',
				slug: card.slug,
			}),
		).toBe(true);
	});

	test('id = yes (not exist), slug = yes (not exist)', async () => {
		expect(
			await utils.hasCard(ctx.logContext, ctx.kernel, ctx.session, {
				id: coreTestUtils.generateRandomId(),
				version: '1.0.0',
				slug: coreTestUtils.generateRandomSlug(),
			}),
		).toBe(false);
	});

	test('id = no, slug = yes (exists)', async () => {
		const card = await ctx.kernel.insertCard(ctx.logContext, ctx.session, {
			slug: coreTestUtils.generateRandomSlug(),
			type: 'card@1.0.0',
			version: '1.0.0',
		});

		expect(
			await utils.hasCard(ctx.logContext, ctx.kernel, ctx.session, {
				version: '1.0.0',
				slug: card.slug,
			} as any),
		).toBe(true);
	});

	test('id = no, slug = yes (not exist)', async () => {
		expect(
			await utils.hasCard(ctx.logContext, ctx.kernel, ctx.session, {
				version: '1.0.0',
				slug: coreTestUtils.generateRandomSlug(),
			} as any),
		).toBe(false);
	});
});
