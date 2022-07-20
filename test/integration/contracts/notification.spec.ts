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

test('Should create a notification if a message is attached to a subscribed support-thread', async () => {
	const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
	const session = await ctx.createSession(user);
	const supportThread = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			status: 'open',
		},
	);
	const subscription = await ctx.createContract(
		user.id,
		session.id,
		'subscription@1.0.0',
		`Subscription to ${supportThread.slug}`,
		{},
	);
	await ctx.createLinkThroughWorker(
		user.id,
		session.id,
		supportThread,
		subscription,
		'has attached',
		'is attached to',
	);
	const message = await ctx.createMessage(
		user.id,
		session.id,
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
	const otherUserSession = await ctx.createSession(otherUser);
	const response = await ctx.createMessage(
		otherUser.id,
		otherUserSession.id,
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
