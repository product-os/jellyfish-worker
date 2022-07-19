import { testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test('Should create a notification if user is mentioned', async () => {
	const user1 = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
	const user2 = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
	const session = { actor: user1 };
	const supportThread = await ctx.createSupportThread(
		user1.id,
		session,
		'foobar',
		{
			status: 'open',
		},
	);

	const message = await ctx.createMessage(
		user1.id,
		session,
		supportThread,
		`ping @${user2.slug.replace('user-', '')}`,
	);

	await ctx.flushAll(ctx.session);

	const notification = await ctx.waitForMatch(
		{
			type: 'object',
			properties: {
				type: {
					const: 'notification@1.0.0',
				},
			},
			required: ['type'],
			$$links: {
				'is attached to': {
					type: 'object',
					properties: {
						id: {
							const: message.id,
						},
					},
					required: ['id'],
				},
				notifies: {
					type: 'object',
					properties: {
						id: {
							const: user2.id,
						},
					},
					required: ['id'],
				},
			},
		},
		3,
	);

	expect(notification).toBeDefined();
});

test('Should create a notification if a message is attached to a subscribed support-thread', async () => {
	const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
	const session = { actor: user };
	const supportThread = await ctx.createSupportThread(
		user.id,
		session,
		'foobar',
		{
			status: 'open',
		},
	);
	const subscription = await ctx.createContract(
		user.id,
		session,
		'subscription@1.0.0',
		`Subscription to ${supportThread.slug}`,
		{},
	);
	await ctx.createLinkThroughWorker(
		user.id,
		session,
		supportThread,
		subscription,
		'has attached',
		'is attached to',
	);
	const message = await ctx.createMessage(
		user.id,
		session,
		supportThread,
		'buz',
	);

	// Should not generate notification to the sender
	await expect(
		ctx.waitForMatch(
			{
				type: 'object',
				properties: {
					type: {
						const: 'notification@1.0.0',
					},
				},
				required: ['type'],
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								const: message.id,
							},
						},
						required: ['id'],
					},
				},
			},
			3,
		),
	).rejects.toThrowError(new Error('The wait query did not resolve'));

	// Add another event by a second user
	const otherUser = await ctx.createUser(
		autumndbTestUtils.generateRandomSlug(),
	);
	const otherUserSession = { actor: otherUser };
	const response = await ctx.createMessage(
		otherUser.id,
		otherUserSession,
		supportThread,
		'baz',
	);
	await ctx.waitForMatch({
		type: 'object',
		properties: {
			type: {
				const: 'notification@1.0.0',
			},
		},
		required: ['type'],
		$$links: {
			'is attached to': {
				type: 'object',
				properties: {
					id: {
						const: response.id,
					},
				},
				required: ['id'],
			},
		},
	});
});
