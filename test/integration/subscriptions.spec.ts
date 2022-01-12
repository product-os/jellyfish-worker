import { ActionLibrary } from '@balena/jellyfish-action-library';
import { cardMixins, testUtils as coreTestUtils } from '@balena/jellyfish-core';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import _ from 'lodash';
import { testUtils } from '../../lib';

let ctx: testUtils.TestContext;
let user: any = {};
let session: any = {};

beforeAll(async () => {
	ctx = await testUtils.newContext({
		plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin],
		mixins: cardMixins,
	});

	user = await ctx.createUser(coreTestUtils.generateRandomId());
	session = await ctx.createSession(user);
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test('Should generate a notification if message is added to subscribed thread', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			product: 'jellyfish',
			status: 'open',
		},
	);
	const subscription = await ctx.createContract(
		user.id,
		session.id,
		'subscription@1.0.0',
		'Subscription to foo',
		{},
	);
	await ctx.createLink(
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
		'Message text',
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

	// Add a response to the thread using a second user
	const otherUser = await ctx.createUser(coreTestUtils.generateRandomId());
	const otherUserSession = await ctx.createSession(otherUser);
	const response = await ctx.createMessage(
		otherUser.id,
		otherUserSession.id,
		supportThread,
		'Response from other user',
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
