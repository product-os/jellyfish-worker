import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import _ from 'lodash';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;
let user: any;
let userSession: any;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	user = await ctx.createUser(coreTestUtils.generateRandomId());
	userSession = await ctx.createSession(user);
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('role-user-community', () => {
	it('users should be able to query views', async () => {
		expect(user.data.roles).toEqual(['user-community']);

		const results = await ctx.kernel.query(ctx.logContext, userSession.id, {
			type: 'object',
			required: ['type'],
			properties: {
				type: {
					type: 'string',
					const: 'view@1.0.0',
				},
			},
		});
		expect(_.includes(_.map(results, 'slug'), 'view-all-views')).toBe(true);
	});

	test('users should not be able to view messages on threads they cannot view', async () => {
		const otherUser = await ctx.createUser(coreTestUtils.generateRandomId());
		expect(otherUser.data.roles).toEqual(['user-community']);

		const otherUserSession = await ctx.createSession(otherUser);

		const foo = await ctx.createContract(
			user.id,
			userSession.id,
			'card@1.0.0',
			'foobar',
			{},
		);
		await ctx.worker.patchCard(
			ctx.logContext,
			userSession.id,
			ctx.worker.typeContracts[foo.type],
			{
				attachEvents: true,
				actor: user.id,
			},
			foo,
			[
				{
					op: 'replace',
					path: '/markers',
					value: [user.slug],
				},
			],
		);
		const bar = await ctx.createEvent(
			user.id,
			userSession.id,
			foo,
			'buz',
			'card',
		);

		const result = await ctx.kernel.getContractById(
			ctx.logContext,
			otherUserSession.id,
			bar.id,
		);
		expect(result).toBeNull();
	});
});
