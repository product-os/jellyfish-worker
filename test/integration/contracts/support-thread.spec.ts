import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;
let user: any = {};
let session: any = {};

beforeAll(async () => {
	ctx = await testUtils.newContext();

	user = await ctx.createUser(autumndbTestUtils.generateRandomId());
	session = await ctx.createSession(user);
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

const waitForThreadWithLastMessage = async (thread: any, event: any) => {
	return ctx.waitForMatch({
		type: 'object',
		required: ['id', 'data'],
		properties: {
			id: {
				const: thread.id,
			},
			data: {
				type: 'object',
				required: ['lastMessage'],
				properties: {
					lastMessage: {
						type: 'object',
						required: ['type', 'data'],
						properties: {
							type: {
								const: event.type,
							},
							data: {
								type: 'object',
								required: ['payload'],
								properties: {
									payload: {
										type: 'object',
										required: ['message'],
										properties: {
											message: {
												const: event.data.payload.message,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	});
};

test('should evaluate the last message in a support thread', async () => {
	const supportThreadSummary = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			status: 'open',
		},
	);

	// Initially the lastMessage field will be undefined as there aren't any messages attached to the thread
	let supportThread = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		supportThreadSummary.id,
	);
	assert(supportThread);
	expect(supportThread.data.lastMessage).toBeFalsy();

	// Now we add a message to the thread's timeline
	const message0Summary = await ctx.createMessage(
		user.id,
		session.id,
		supportThread,
		'buz',
	);
	const message0 = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		message0Summary.id,
	);
	assert(message0);

	// Now we wait for the lastMessage field to be updated to the whisper we just added to the thread
	supportThread = await waitForThreadWithLastMessage(supportThread, message0);
	expect(supportThread.data.lastMessage).toEqual(message0);

	// Now let's add another message to the thread's timeline
	const message1Summary = await ctx.createMessage(
		user.id,
		session.id,
		supportThread,
		'baz',
	);
	const message1 = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		message1Summary.id,
	);
	assert(message1);

	// If we add an update to the thread, this does not affect the evaluated lastMessage field
	await ctx.worker.patchCard(
		ctx.logContext,
		session.id,
		ctx.worker.typeContracts[supportThread.type],
		{
			attachEvents: true,
			actor: user.id,
		},
		supportThread,
		[
			{
				op: 'replace',
				path: '/name',
				value: `Thread ${autumndbTestUtils.generateRandomId()}`,
			},
		],
	);
	await ctx.flushAll(session);

	// And wait for the lastMessage field to be updated to this new message
	supportThread = await waitForThreadWithLastMessage(supportThread, message1);
	expect(supportThread.data.lastMessage).toEqual(message1);
});
