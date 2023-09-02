import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(async () => {
	await testUtils.destroyContext(ctx);
});

describe('stream', () => {
	it('should report back action requests', async () => {
		const emitter = await ctx.kernel.stream(
			ctx.logContext,
			ctx.kernel.adminSession()!,
			{
				type: 'object',
				additionalProperties: false,
				properties: {
					type: {
						type: 'string',
						pattern: '^action-request@',
					},
					data: {
						type: 'object',
						properties: {
							action: {
								type: 'string',
							},
							actor: {
								type: 'string',
							},
							timestamp: {
								type: 'string',
							},
							arguments: {
								type: 'object',
								additionalProperties: true,
							},
						},
					},
				},
				required: ['type'],
			},
		);

		const result = await new Promise<any>((resolve, reject) => {
			emitter.on('data', (change) => {
				emitter.close();
				resolve(change);
			});

			emitter.on('error', reject);

			ctx.kernel
				.insertContract(ctx.logContext, ctx.kernel.adminSession()!, {
					type: 'action-request@1.0.0',
					data: {
						context: ctx.logContext,
						action: 'action-delete-card@1.0.0',
						actor: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
						epoch: 1521170969543,
						timestamp: '2018-03-16T03:29:29.543Z',
						input: {
							id: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
							type: 'card@1.0.0',
						},
						arguments: {},
					},
				})
				.catch((err) => {
					reject(err);
				});
			ctx.kernel
				.insertContract(ctx.logContext, ctx.kernel.adminSession()!, {
					type: 'card@1.0.0',
					data: {
						email: 'johndoe@example.com',
					},
				})
				.catch((err) => {
					reject(err);
				});
		});

		expect(result.after).toEqual({
			id: result.id,
			type: 'action-request@1.0.0',
			data: {
				context: ctx.logContext,
				epoch: 1521170969543,
				action: 'action-delete-card@1.0.0',
				actor: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				input: {
					id: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					type: 'card@1.0.0',
				},
				timestamp: '2018-03-16T03:29:29.543Z',
				arguments: {},
			},
		});
	});
});
