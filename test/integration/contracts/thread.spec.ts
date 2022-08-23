import {
	AutumnDBSession,
	testUtils as autumndbTestUtils,
	UserContract,
} from 'autumndb';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;
let user: UserContract;
let session: AutumnDBSession;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	user = await ctx.createUser(autumndbTestUtils.generateRandomId());
	session = { actor: user };
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test('should use the first message as the name of the thread', async () => {
	const thread = await ctx.createContract(
		user.id,
		session,
		'thread@1.0.0',
		null,
		{},
	);

	const text = 'Hello world!';

	// Now we add a message to the thread's timeline
	await ctx.createMessage(user.id, session, thread, text);
	await ctx.createMessage(user.id, session, thread, 'baz');

	await ctx.flushAll(session);

	// And wait for the lastMessage field to be updated to this new message
	const result = await ctx.kernel.getContractById(
		ctx.logContext,
		session,
		thread.id,
	);

	expect(result?.name).toBe(text);
});

test('should not overwrite the name of the thread if it already exists', async () => {
	const thread = await ctx.createContract(
		user.id,
		session,
		'thread@1.0.0',
		'My lovely thread',
		{},
	);

	// Now we add a message to the thread's timeline
	await ctx.createMessage(user.id, session, thread, 'Hello world!');
	await ctx.createMessage(user.id, session, thread, 'baz');

	await ctx.flushAll(session);

	// And wait for the lastMessage field to be updated to this new message
	const result = await ctx.kernel.getContractById(
		ctx.logContext,
		session,
		thread.id,
	);

	expect(result?.name).toBe('My lovely thread');
});
