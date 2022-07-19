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

test('should close a thread with a #summary whisper', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session,
		'foobar',
		{
			status: 'open',
		},
	);
	await ctx.createWhisper(user.id, session, supportThread, '#summary buz');

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
						const: 'closed',
					},
				},
			},
		},
	});
});
