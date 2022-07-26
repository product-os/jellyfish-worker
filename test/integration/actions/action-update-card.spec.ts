import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils, UserContract } from 'autumndb';
import { ActionContract, testUtils, WorkerContext } from '../../../lib';
import { actionUpdateCard } from '../../../lib/actions/action-update-card';

let ctx: testUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
	actionContext = ctx.worker.getActionContext(ctx.logContext);
});

afterAll(async () => {
	await testUtils.destroyContext(ctx);
});

describe('action-update-card', () => {
	test('operators should be able to update other user contracts', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomId(),
			undefined,
			['user-community', 'user-operator'],
		);
		expect(user.data.roles).toEqual(['user-community', 'user-operator']);
		const otherUser = await ctx.createUser(
			autumndbTestUtils.generateRandomId(),
		);

		await actionUpdateCard.handler(
			{
				actor: user,
			},
			actionContext,
			otherUser,
			{
				action: {} as ActionContract,
				card: otherUser.id,
				timestamp: new Date().toISOString(),
				actor: user.id,
				logContext: ctx.logContext,
				epoch: new Date().valueOf(),
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/data/email',
							value: 'foo@bar.com',
						},
					],
				},
			},
		);
		const updated = await ctx.kernel.getContractById<UserContract>(
			ctx.logContext,
			{ actor: user },
			otherUser.id,
		);
		assert(updated);
		expect(updated.data.email).toEqual('foo@bar.com');
	});

	test('user-admin should be able to update other user contracts', async () => {
		const adminUser = await ctx.kernel.getContractById<UserContract>(
			ctx.logContext,
			ctx.kernel.adminSession()!,
			ctx.adminUserId,
		);
		assert(adminUser);
		const otherUser = await ctx.createUser(
			autumndbTestUtils.generateRandomId(),
		);

		await actionUpdateCard.handler(
			{
				actor: adminUser,
			},
			actionContext,
			otherUser,
			{
				action: {} as ActionContract,
				card: otherUser.id,
				timestamp: new Date().toISOString(),
				actor: adminUser.id,
				logContext: ctx.logContext,
				epoch: new Date().valueOf(),
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/data/email',
							value: 'foo@bar.com',
						},
					],
				},
			},
		);
		const updated = await ctx.kernel.getContractById<UserContract>(
			ctx.logContext,
			{ actor: adminUser },
			otherUser.id,
		);
		assert(updated);
		expect(updated.data.email).toEqual('foo@bar.com');
	});
});
