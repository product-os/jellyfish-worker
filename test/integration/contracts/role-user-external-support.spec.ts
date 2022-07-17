import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;
let balenaOrg: any;
let testOrg: any;

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
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('role-user-community', () => {
	it('users should not be able to create threads with product values other than balenaCloud', async () => {
		const user = await createUser(['user-external-support'], balenaOrg);
		const session = await ctx.createSession(user);

		await expect(
			ctx.createSupportThread(user.id, session.id, 'foobar', {
				product: 'test-product',
				inbox: 'S/Paid_Support',
				status: 'open',
			}),
		).rejects.toThrowError();
	});

	it('the message sent by external support user should be only visible for balena organisation users', async () => {
		const supportUser1 = await createUser(['user-external-support'], testOrg);
		const supportUser1Session = await ctx.createSession(supportUser1);
		const supportUser2 = await createUser(['user-external-support'], testOrg);
		const supportUser2Session = await ctx.createSession(supportUser2);
		const communityUser = await createUser(['user-community'], balenaOrg);
		const communityUserSession = await ctx.createSession(communityUser);

		const thread = await ctx.createSupportThread(
			supportUser1.id,
			supportUser1Session.id,
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
			supportUser1Session.id,
			thread,
			'buz',
		);

		// Try getting thread and message using supportUser2
		expect(
			await ctx.kernel.getContractById(
				ctx.logContext,
				supportUser2Session.id,
				thread.id,
			),
		).toBeNull();
		expect(
			await ctx.kernel.getContractById(
				ctx.logContext,
				supportUser2Session.id,
				message.id,
			),
		).toBeNull();

		// Try getting thread and message using communityUser
		const thread2 = await ctx.kernel.getContractById(
			ctx.logContext,
			communityUserSession.id,
			thread.id,
		);
		assert(thread2);
		expect(thread2.id).toEqual(thread.id);
		const message2 = await ctx.kernel.getContractById(
			ctx.logContext,
			communityUserSession.id,
			message.id,
		);
		assert(message2);
		expect(message2.id).toEqual(message.id);
	});

	it('external support user should not be able to create a thread with markers other than <user.slug>+org-balena', async () => {
		const user = await createUser(['user-external-support'], testOrg);
		const session = await ctx.createSession(user);

		await expect(
			ctx.createSupportThread(
				user.id,
				session.id,
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
				session.id,
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
		const session = await ctx.createSession(user);

		const types = (
			await ctx.kernel.query(ctx.logContext, session.id, {
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
});
