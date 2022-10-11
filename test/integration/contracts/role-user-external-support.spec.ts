import { strict as assert } from 'assert';
import {
	RelationshipContract,
	testUtils as autumndbTestUtils,
	UserContract,
} from 'autumndb';
import _ from 'lodash';
import { ActionContract, testUtils, WorkerContext } from '../../../lib';
import { actionUpdateCard } from '../../../lib/actions/action-update-card';

let ctx: testUtils.TestContext;
let balenaOrg: any;
let testOrg: any;
let actionContext: WorkerContext;

async function createUser(roles: string[], org: any): Promise<any> {
	// Create user
	const user = await ctx.createUser(
		autumndbTestUtils.generateRandomId(),
		autumndbTestUtils.generateRandomId(),
		roles,
	);

	// Link user to org
	await ctx.createLinkThroughWorker(
		ctx.adminUserId,
		ctx.session,
		user,
		org,
		'is member of',
		'has member',
	);

	return user;
}

beforeAll(async () => {
	ctx = await testUtils.newContext();

	// Set balena org
	balenaOrg = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(balenaOrg);

	// Set test org
	testOrg = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'org@1.0.0',
		'test-org',
		{},
	);
	assert(testOrg);
	actionContext = ctx.worker.getActionContext(ctx.logContext);
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('role-user-community', () => {
	it('users should not be able to create threads with product values other than balenaCloud', async () => {
		const user = await createUser(['user-external-support'], balenaOrg);
		const session = { actor: user };

		await expect(
			ctx.createSupportThread(user.id, session, 'foobar', {
				product: 'test-product',
				inbox: 'S/Paid_Support',
				status: 'open',
			}),
		).rejects.toThrowError();
	});

	it('users should be able to read, but not write relationship contracts', async () => {
		const user = await createUser(['user-external-support'], balenaOrg);
		const session = { actor: user };

		const relationships = await ctx.kernel.query<RelationshipContract>(
			ctx.logContext,
			session,
			{
				type: 'object',
				properties: {
					type: {
						const: 'relationship@1.0.0',
					},
				},
			},
		);

		await expect(relationships.length).toBeGreaterThan(0);

		await expect(
			ctx.kernel.patchContractBySlug(
				ctx.logContext,
				session,
				relationships[0].slug,
				[
					{
						op: 'replace',
						path: '/name',
						value: 'new name',
					},
				],
			),
		).rejects.toThrowError();

		await expect(
			ctx.kernel.insertContract<RelationshipContract>(ctx.logContext, session, {
				type: 'relationship@1.0.0',
				name: 'flies',
				slug: 'relationship-pilot-flies-plane',
				data: {
					title: 'Plane',
					inverseName: 'is flown by',
					inverseTitle: 'Pilot',
					from: {
						type: 'pilot',
					},
					to: {
						type: 'plane',
					},
				},
			}),
		).rejects.toThrowError();
	});

	it('the message sent by external support user should be only visible for balena organisation users', async () => {
		const supportUser1 = await createUser(['user-external-support'], testOrg);
		const supportUser1Session = { actor: supportUser1 };
		const supportUser2 = await createUser(['user-external-support'], testOrg);
		const supportUser2Session = { actor: supportUser2 };
		const communityUser = await createUser(['user-community'], balenaOrg);
		const communityUserSession = { actor: communityUser };

		const thread = await ctx.createSupportThread(
			supportUser1.id,
			supportUser1Session,
			'foobar',
			{
				product: 'balenaCloud',
				inbox: 'S/Paid_Support',
				status: 'open',
			},
			[`${supportUser1.slug}+org-balena`],
		);
		const message = await ctx.createMessage(
			supportUser1.id,
			supportUser1Session,
			thread,
			'buz',
		);

		// Try getting thread and message using supportUser2
		expect(
			await ctx.kernel.getContractById(
				ctx.logContext,
				supportUser2Session,
				thread.id,
			),
		).toBeNull();
		expect(
			await ctx.kernel.getContractById(
				ctx.logContext,
				supportUser2Session,
				message.id,
			),
		).toBeNull();

		// Try getting thread and message using communityUser
		const thread2 = await ctx.kernel.getContractById(
			ctx.logContext,
			communityUserSession,
			thread.id,
		);
		assert(thread2);
		expect(thread2.id).toEqual(thread.id);
		const message2 = await ctx.kernel.getContractById(
			ctx.logContext,
			communityUserSession,
			message.id,
		);
		assert(message2);
		expect(message2.id).toEqual(message.id);
	});

	it('external support user should not be able to create a thread with markers other than <user.slug>+org-balena', async () => {
		const user = await createUser(['user-external-support'], testOrg);
		const session = { actor: user };

		await expect(
			ctx.createSupportThread(
				user.id,
				session,
				'foobar',
				{
					product: 'balenaCloud',
					inbox: 'S/Paid_Support',
					status: 'open',
				},
				[`${user.slug}+org-other`],
			),
		).rejects.toThrowError();

		await expect(
			ctx.createSupportThread(
				user.id,
				session,
				'foobar',
				{
					product: 'balenaCloud',
					inbox: 'S/Paid_Support',
					status: 'open',
				},
				[],
			),
		).rejects.toThrowError();
	});

	it('external support user should not be able to view other card types', async () => {
		const user = await createUser(['user-external-support'], testOrg);
		const session = { actor: user };

		const types = (
			await ctx.kernel.query(ctx.logContext, session, {
				type: 'object',
				additionalProperties: true,
				required: ['type'],
				properties: {
					type: {
						type: 'string',
						const: 'type@1.0.0',
					},
				},
			})
		)
			.map((typeCard) => {
				return typeCard.slug;
			})
			.sort();

		expect(types).toEqual([
			'card',
			'create',
			'link',
			'message',
			'notification',
			'subscription',
			'support-thread',
			'update',
			'view',
		]);
	});

	test('should not be able to update other user contracts', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomId(),
			undefined,
			['user-external-support'],
		);
		expect(user.data.roles).toEqual(['user-external-support']);
		const otherUser = await ctx.createUser(
			autumndbTestUtils.generateRandomId(),
		);

		await expect(() => {
			return actionUpdateCard.handler(
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
		}).rejects.toThrow();
	});

	test('should not be able to change own roles', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomId(),
			undefined,
			['user-external-support'],
		);
		expect(user.data.roles).toEqual(['user-external-support']);
		user.data.roles.push('user-operator');

		await actionUpdateCard.handler(
			{
				actor: user,
			},
			actionContext,
			user,
			{
				action: {} as ActionContract,
				card: user.id,
				timestamp: new Date().toISOString(),
				actor: user.id,
				logContext: ctx.logContext,
				epoch: new Date().valueOf(),
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/data/roles',
							value: user.data.roles,
						},
					],
				},
			},
		);

		const updated = await ctx.kernel.getContractById<UserContract>(
			ctx.logContext,
			ctx.kernel.adminSession()!,
			user.id,
		);
		assert(updated);
		expect(updated.data.roles).toEqual(['user-external-support']);
	});
});
