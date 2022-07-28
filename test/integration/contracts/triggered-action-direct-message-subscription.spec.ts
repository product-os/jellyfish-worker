import { testUtils as autumndbTestUtils } from 'autumndb';
import { strict as assert } from 'assert';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test('should create subscriptions on behalf of participating actors', async () => {
	const user1 = await ctx.createUser(autumndbTestUtils.generateRandomId());
	const user2 = await ctx.createUser(autumndbTestUtils.generateRandomId());
	const session = { actor: user1 };

	// Create the thread
	const thread = await ctx.createContract(
		user1.id,
		session,
		'thread@1.0.0',
		'My thread',
		{
			dms: true,
			actors: [user1.slug, user2.slug],
		},
	);

	assert(thread);

	const [threadWithSubs] = await ctx.kernel.query(ctx.logContext, ctx.session, {
		type: 'object',
		properties: {
			id: {
				const: thread.id,
			},
		},
		$$links: {
			'has attached': {
				type: 'object',
				properties: {
					type: {
						const: 'subscription@1.0.0',
					},
				},
				$$links: {
					'has attached element': {
						type: 'object',
						properties: {
							type: {
								const: 'create@1.0.0',
							},
							data: {
								type: 'object',
								properties: {
									actor: {
										type: 'string',
									},
								},
								required: ['actor'],
							},
						},
						required: ['type', 'data'],
					},
				},
			},
		},
	});

	assert(threadWithSubs);

	// There should be two attached subscriptions. One for each user
	expect(threadWithSubs.links?.['has attached'].length).toBe(2);

	// Post a message to the thread
	const message1 = await ctx.createMessage(
		user1.id,
		session,
		thread,
		'Hey buddy!',
	);

	// The other user should receive a notification
	const notification1 = await ctx.waitForMatch({
		type: 'object',
		properties: {
			markers: {
				type: 'array',
				contains: {
					type: 'string',
					const: user2.slug,
				},
			},
			type: {
				const: 'notification@1.0.0',
			},
		},
		$$links: {
			'is attached to': {
				type: 'object',
				properties: {
					id: {
						const: message1.id,
					},
				},
			},
		},
	});

	expect(notification1).toBeTruthy();

	// The same should work with the users reversed
	const message2 = await ctx.createMessage(
		user2.id,
		{ actor: user2 },
		thread,
		"How's it going?",
	);

	// The other user should receive a notification
	const notification2 = await ctx.waitForMatch({
		type: 'object',
		properties: {
			markers: {
				type: 'array',
				contains: {
					type: 'string',
					const: user1.slug,
				},
			},
			type: {
				const: 'notification@1.0.0',
			},
		},
		$$links: {
			'is attached to': {
				type: 'object',
				properties: {
					id: {
						const: message2.id,
					},
				},
			},
		},
	});

	expect(notification2).toBeTruthy();
});
