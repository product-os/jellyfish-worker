import { strict as assert } from 'assert';
import {
	AutumnDBSession,
	testUtils as autumndbTestUtils,
	UserContract,
} from 'autumndb';
import _ from 'lodash';
import { ActionContract, testUtils, WorkerContext } from '../../../lib';
import { actionUpdateCard } from '../../../lib/actions/action-update-card';

let ctx: testUtils.TestContext;
let user: UserContract;
let session: AutumnDBSession;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
	actionContext = ctx.worker.getActionContext(ctx.logContext);

	user = await ctx.createUser(autumndbTestUtils.generateRandomId());
	session = { actor: user };
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('role-user-community', () => {
	it('users should be able to query views', async () => {
		expect(user.data.roles).toEqual(['user-community']);

		const results = await ctx.kernel.query(ctx.logContext, session, {
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
		const otherUserSession = { actor: otherUser };

		const supportThread = await ctx.createSupportThread(
			user.id,
			session,
			'foobar',
			{
				status: 'open',
			},
		);
		await ctx.worker.patchCard(
			ctx.logContext,
			session,
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
			session,
			supportThread,
			'buz',
		);

		const result = await ctx.kernel.getContractById(
			ctx.logContext,
			otherUserSession,
			message.id,
		);
		expect(result).toBeNull();
	});

	test('should be able to update own user contract', async () => {
		const userFoo = await ctx.createUser(autumndbTestUtils.generateRandomId());
		expect(userFoo.data.roles).toEqual(['user-community']);
		expect(userFoo.data.email).not.toEqual('foo@bar.com');

		await actionUpdateCard.handler(
			{
				actor: userFoo,
			},
			actionContext,
			userFoo,
			{
				action: {} as ActionContract,
				card: userFoo.id,
				timestamp: new Date().toISOString(),
				actor: userFoo.id,
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
			{ actor: userFoo },
			userFoo.id,
		);
		assert(updated);
		expect(updated.data.email).toEqual('foo@bar.com');
	});

	test('should not be able to change own roles', async () => {
		const userFoo = await ctx.createUser(autumndbTestUtils.generateRandomId());
		expect(userFoo.data.roles).toEqual(['user-community']);
		userFoo.data.roles.push('user-operator');

		await actionUpdateCard.handler(
			{
				actor: userFoo,
			},
			actionContext,
			userFoo,
			{
				action: {} as ActionContract,
				card: userFoo.id,
				timestamp: new Date().toISOString(),
				actor: userFoo.id,
				logContext: ctx.logContext,
				epoch: new Date().valueOf(),
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/data/roles',
							value: userFoo.data.roles,
						},
					],
				},
			},
		);
		const updated = await ctx.kernel.getContractById<UserContract>(
			ctx.logContext,
			ctx.kernel.adminSession()!,
			userFoo.id,
		);
		assert(updated);
		expect(updated.data.roles).toEqual(['user-community']);
	});

	test('should not be able to update other user contracts', async () => {
		const userFoo = await ctx.createUser(autumndbTestUtils.generateRandomId());
		expect(userFoo.data.roles).toEqual(['user-community']);
		const otherUser = await ctx.createUser(
			autumndbTestUtils.generateRandomId(),
		);

		await expect(() => {
			return actionUpdateCard.handler(
				{
					actor: userFoo,
				},
				actionContext,
				otherUser,
				{
					action: {} as ActionContract,
					card: otherUser.id,
					timestamp: new Date().toISOString(),
					actor: userFoo.id,
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
		}).rejects.toThrow();
	});
});
