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

test('should re-open a closed support thread if a new message is added', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			status: 'closed',
		},
	);

	// Add a new message to the thread, and then wait for the support thread to be re-opened
	await ctx.createMessage(user.id, session.id, supportThread, 'buz');

	await ctx.waitForMatch({
		type: 'object',
		required: ['id', 'data'],
		properties: {
			id: {
				const: supportThread.id,
			},
			data: {
				type: 'object',
				required: ['status'],
				properties: {
					status: {
						const: 'open',
					},
				},
			},
		},
	});
});

test('should not re-open a closed thread by marking a message as read', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			status: 'open',
		},
	);

	// Add a new message to the thread
	const message = await ctx.createMessage(
		user.id,
		session.id,
		supportThread,
		'buz',
	);

	// Close the thread
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
				path: '/data/status',
				value: 'closed',
			},
		],
	);
	await ctx.flushAll(session.id);

	// Mark the message as read
	await ctx.worker.patchCard(
		ctx.logContext,
		session.id,
		ctx.worker.typeContracts[message.type],
		{
			attachEvents: true,
			actor: user.id,
		},
		message,
		[
			{
				op: 'add',
				path: '/data/readBy',
				value: ['johndoe'],
			},
		],
	);
	await ctx.flushAll(session.id);

	// Wait a while to verify no triggered actions run
	await new Promise((resolve) => {
		setTimeout(resolve, 5000);
	});

	// Check that the thread is still closed
	const thread = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		supportThread.id,
	);
	assert(thread);
	expect(thread.active).toEqual(true);
	expect(thread.data.status).toEqual('closed');
});

test('should not re-open a closed thread with a whisper', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			status: 'closed',
		},
	);
	await ctx.createWhisper(user.id, session.id, supportThread, 'buz');

	// Wait a while to verify no triggered actions run
	await new Promise((resolve) => {
		setTimeout(resolve, 5000);
	});

	// Check that the thread is still closed
	const thread = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		supportThread.id,
	);
	assert(thread);
	expect(thread.active).toEqual(true);
	expect(thread.data.status).toEqual('closed');
});

test('should re-open an archived thread with a message', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			status: 'archived',
		},
	);
	await ctx.createMessage(user.id, session.id, supportThread, 'buz');

	const thread = await ctx.waitForMatch({
		type: 'object',
		required: ['id', 'data'],
		properties: {
			id: {
				const: supportThread.id,
			},
			data: {
				type: 'object',
				required: ['status'],
				properties: {
					status: {
						const: 'open',
					},
				},
			},
		},
	});
	expect(thread.active).toEqual(true);
	expect(thread.data.status).toEqual('open');
});

test('should not re-open an archived thread with a whisper', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session.id,
		'foobar',
		{
			status: 'archived',
		},
	);
	await ctx.createWhisper(user.id, session.id, supportThread, 'buz');

	// Wait a while to verify no triggered actions run
	await new Promise((resolve) => {
		setTimeout(resolve, 5000);
	});

	// Check that the thread is still archived
	const thread = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		supportThread.id,
	);
	assert(thread);
	expect(thread.active).toEqual(true);
	expect(thread.data.status).toEqual('archived');
});
