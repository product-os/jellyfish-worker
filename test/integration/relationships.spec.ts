import { TypeContract } from 'autumndb';
import _ from 'lodash';
import { setTimeout as delay } from 'timers/promises';
import { testUtils } from '../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});
afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('Relationships', () => {
	it('should calculate formula fields that use links when the relationship is inserted after the type', async () => {
		const pilotType = await ctx.kernel.insertContract<TypeContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'type@1.0.0',
				name: 'Pilot',
				data: {
					schema: {
						type: 'object',
						properties: {
							data: {
								type: 'object',
								properties: {
									planesFlown: {
										type: 'number',
										$$formula:
											'contract.links["flies"] ? contract.links["flies"].length : 0',
									},
								},
							},
						},
					},
				},
			},
		);

		const planeType = await ctx.kernel.insertContract<TypeContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'type@1.0.0',
				name: 'Plane',
				data: {
					schema: {
						type: 'object',
						properties: {},
					},
				},
			},
		);

		// Now insert the relationship *after* the types have been created
		const relationshipSlug = `relationship-${pilotType.slug}-flies-${planeType.slug}`;
		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts['relationship@1.0.0'],
			{
				attachEvents: false,
			},
			{
				slug: relationshipSlug,
				type: 'relationship@1.0.0',
				name: 'flies',
				data: {
					inverseName: 'is flown by',
					title: 'Planes',
					inverseTitle: 'Pilots',
					from: {
						type: pilotType.slug,
					},
					to: {
						type: planeType.slug,
					},
				},
			},
		);

		// Wait until the relationship is ready and avaiable in the kernel
		while (true) {
			await delay(500);
			const relationships = ctx.kernel.getRelationships();
			const found = relationships.find((r) => r.slug === relationshipSlug);
			if (found) {
				break;
			}
		}

		// Create two subject contracts
		const pilot = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			pilotType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				name: 'The pilot',
			},
		))!;
		const plane = (await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			planeType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				name: 'The plane',
			},
		))!;

		const linkType = ctx.worker.typeContracts['link@1.0.0'];

		// Link the contracts together, which should result in the formula field being updated
		await ctx.worker.insertCard(
			ctx.logContext,
			ctx.session,
			linkType,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				attachEvents: false,
				reason: null,
			},
			{
				name: 'flies',
				data: {
					inverseName: 'is flown by',
					from: {
						id: pilot.id,
						slug: pilot.slug,
						type: pilot.type,
					},
					to: {
						id: plane.id,
						slug: plane.slug,
						type: plane.type,
					},
				},
			},
		);

		await ctx.flushAll(ctx.session);

		await delay(1000);

		const result = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			required: ['id'],
			properties: {
				id: {
					type: 'string',
					const: pilot.id,
				},
				data: {
					type: 'object',
					required: ['planesFlown'],
					properties: {
						planesFlown: {
							type: 'number',
							const: 1,
						},
					},
				},
			},
		});

		expect(result.data.planesFlown).toBe(1);
	});
});
