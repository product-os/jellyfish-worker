import { testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import { testUtils } from '../../../lib';
import type { MessageContract } from '../../../lib/types';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test('Should aggregate reactions', async () => {
	const user = await ctx.createUser(autumndbTestUtils.generateRandomSlug());
	const session = { actor: user };
	const message = await ctx.createContract(
		user.id,
		session,
		'message@1.0.0',
		'test message',
		{
			actor: user.id,
			timestamp: new Date().toISOString(),
			payload: {
				message: 'lorem ipsum',
			},
		},
	);

	const reaction = await ctx.createContract(
		user.id,
		session,
		'reaction@1.0.0',
		null,
		{
			reaction: ':+1:',
		},
	);

	await ctx.createLinkThroughWorker(
		user.id,
		session,
		reaction,
		message,
		'is attached to',
		'has attached element',
	);

	await ctx.flushAll(ctx.session);

	const result = await ctx.kernel.getContractById<MessageContract>(
		ctx.logContext,
		ctx.session,
		message.id,
	);

	expect(result).not.toBeNull();

	expect(result!.data.payload.reactions).toEqual({
		[reaction.data.reaction as any]: 1,
	});
});
