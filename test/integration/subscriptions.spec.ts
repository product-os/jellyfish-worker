/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as _ from 'lodash';
import ActionLibrary from '@balena/jellyfish-action-library';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { Worker } from '../../lib';

let ctx: integrationHelpers.IntegrationTestContext;
let user: any = {};
let userSession: string = '';

beforeAll(async () => {
	ctx = await integrationHelpers.before(
		[DefaultPlugin, ActionLibrary, ProductOsPlugin],
		[],
		{
			worker: Worker,
		},
	);

	const createdUser = await ctx.createUser(ctx.generateRandomID());
	user = createdUser.contract;
	userSession = createdUser.session;
});

afterAll(() => {
	return integrationHelpers.after(ctx);
});

test('Should generate a notification if message is added to subscribed thread', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		userSession,
		ctx.generateRandomWords(3),
		{
			product: 'jellyfish',
			status: 'open',
		},
	);
	const subscription = await ctx.createContract(
		user.id,
		userSession,
		'subscription@1.0.0',
		'Subscription to foo',
		{},
	);
	await ctx.createLink(
		user.id,
		userSession,
		supportThread,
		subscription,
		'has attached',
		'is attached to',
	);
	const message = await ctx.createMessage(
		user.id,
		userSession,
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
			5,
		),
	).rejects.toThrowError(new Error('The wait query did not resolve'));

	// Add a response to the thread using a second user
	const otherUser = await ctx.createUser(ctx.generateRandomID());
	const response = await ctx.createMessage(
		otherUser.contract.id,
		otherUser.session,
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
