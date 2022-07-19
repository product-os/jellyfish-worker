import { strict as assert } from 'assert';
import { Kernel } from 'autumndb';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('user-guest', () => {
	it('query: the guest user should only see its own private fields', async () => {
		const guestUser = await ctx.kernel.getContractBySlug(
			ctx.logContext,
			ctx.session,
			'user-guest@1.0.0',
		);
		assert(guestUser);

		const guestUserSession = await ctx.kernel.replaceContract(
			ctx.logContext,
			ctx.session,
			Kernel.defaults({
				slug: 'session-guest',
				version: '1.0.0',
				type: 'session@1.0.0',
				data: {
					actor: guestUser.id,
				},
			}),
		);
		assert(guestUserSession);

		const results = await ctx.kernel.query(
			ctx.logContext,
			guestUserSession.id,
			{
				type: 'object',
				required: ['type', 'data'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'user@1.0.0',
					},
					data: {
						type: 'object',
						properties: {
							email: {
								type: 'string',
							},
						},
					},
				},
			},
		);

		expect(results.length).toEqual(1);
		expect(results[0].slug).toEqual('user-guest');
	});
});
