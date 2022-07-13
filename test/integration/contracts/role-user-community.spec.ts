import { testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;
let user: any = {};
let session: any = {};

beforeAll(async () => {
	ctx = await testUtils.newContext();

	user = await ctx.createUser(autumndbTestUtils.generateRandomId());
	session = await ctx.createSession(user);
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('role-user-community', () => {
	it('users should be able to query views', async () => {
		expect(user.data.roles).toEqual(['user-community']);

		const results = await ctx.kernel.query(ctx.logContext, session.id, {
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
		const otherUser = await ctx.createUser(
			autumndbTestUtils.generateRandomId(),
		);
		expect(otherUser.data.roles).toEqual(['user-community']);
		const otherUserSession = await ctx.createSession(otherUser);

		const supportThread = await ctx.createSupportThread(
			user.id,
			session.id,
			'foobar',
			{
				status: 'open',
			},
		);
		await ctx.worker.patchCard(
			ctx.logContext,
			session.id,
			ctx.worker.typeContracts[supportThread.type],
			{
				attachEvents: true,
				actor: user.id,
			},
			supportThread,
			[
				{
					op: 'replace',
					path: '/markers',
					value: [user.slug],
				},
			],
		);
		const message = await ctx.createMessage(
			user.id,
			session.id,
			supportThread,
			'buz',
		);

		const result = await ctx.kernel.getContractById(
			ctx.logContext,
			otherUserSession.id,
			message.id,
		);
		expect(result).toBeNull();
	});
});
