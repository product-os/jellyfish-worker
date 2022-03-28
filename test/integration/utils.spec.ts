import { testUtils as autumndbTestUtils } from 'autumndb';
import { testUtils } from '../../lib';
import * as utils from '../../lib/utils';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('.hasContract()', () => {
	test('id = yes (exists), slug = yes (exists)', async () => {
		const contract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasContract(ctx.logContext, ctx.kernel, ctx.session, {
				id: contract.id,
				version: '1.0.0',
				slug: contract.slug,
			}),
		).toBe(true);
	});

	test('id = yes (exists), slug = yes (not exist)', async () => {
		const contract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasContract(ctx.logContext, ctx.kernel, ctx.session, {
				id: contract.id,
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomSlug(),
			}),
		).toBe(true);
	});

	test('id = yes (not exist), slug = yes (exists)', async () => {
		const contract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasContract(ctx.logContext, ctx.kernel, ctx.session, {
				id: autumndbTestUtils.generateRandomId(),
				version: '1.0.0',
				slug: contract.slug,
			}),
		).toBe(true);
	});

	test('id = yes (not exist), slug = yes (not exist)', async () => {
		expect(
			await utils.hasContract(ctx.logContext, ctx.kernel, ctx.session, {
				id: autumndbTestUtils.generateRandomId(),
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomSlug(),
			}),
		).toBe(false);
	});

	test('id = no, slug = yes (exists)', async () => {
		const contract = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				slug: autumndbTestUtils.generateRandomSlug(),
				type: 'card@1.0.0',
				version: '1.0.0',
			},
		);

		expect(
			await utils.hasContract(ctx.logContext, ctx.kernel, ctx.session, {
				version: '1.0.0',
				slug: contract.slug,
			} as any),
		).toBe(true);
	});

	test('id = no, slug = yes (not exist)', async () => {
		expect(
			await utils.hasContract(ctx.logContext, ctx.kernel, ctx.session, {
				version: '1.0.0',
				slug: autumndbTestUtils.generateRandomSlug(),
			} as any),
		).toBe(false);
	});
});
