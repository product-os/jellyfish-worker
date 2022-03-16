import { testUtils as coreTestUtils } from 'autumndb';
import _ from 'lodash';
import { testUtils } from '../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test.skip('Should generate a notification if an event is attached to a contract', async () => {
	const user = await ctx.createUser(coreTestUtils.generateRandomSlug());
	const session = await ctx.createSession(user);
	const root = await ctx.createContract(
		user.id,
		session.id,
		'card@1.0.0',
		null,
		{},
	);
	const subscription = await ctx.createContract(
		user.id,
		session.id,
		'subscription@1.0.0',
		'Subscription to foo',
		{},
	);
	await ctx.createLinkThroughWorker(
		user.id,
		session.id,
		root,
		subscription,
		'has attached',
		'is attached to',
	);
	const event = await ctx.createEvent(
		user.id,
		session.id,
		root,
		'event1',
		'card@1.0.0',
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
								const: event.id,
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
	const otherUser = await ctx.createUser(coreTestUtils.generateRandomSlug());
	const otherUserSession = await ctx.createSession(otherUser);
	const response = await ctx.createEvent(
		otherUser.id,
		otherUserSession.id,
		root,
		'event2',
		'card@1.0.0',
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
