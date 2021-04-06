/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { Worker } from './index';
import { core } from '@balena/jellyfish-types';
import { QueueConsumer, QueueProducer, JellyfishKernel } from './types';

describe('Worker.updateCurrentTransformers()', () => {
	test('should generate properly filtered list of transformers', async () => {
		const transformers = [
			{
				id: 'a1.0.0',
				slug: 'a-transformer',
				version: '1.0.0',
			},
			{
				id: 'a1.1.0',
				slug: 'a-transformer',
				version: '1.1.0',
			},
			{
				id: 'a1.1.0',
				slug: 'a-transformer',
				version: '1.1.1-someprerelease',
			},
			{
				id: 'a2.0.0',
				slug: 'a-transformer',
				version: '2.0.0',
			},
			{
				id: 'b1.0.0',
				slug: 'b-transformer',
				version: '1.0.0',
			},
		] as core.Contract[];

		// TS-TODO: is there a better way to instantiate a simple Worker?
		const worker = new Worker(
			({} as any) as JellyfishKernel,
			'session-foo',
			{},
			({} as any) as QueueConsumer,
			({} as any) as QueueProducer,
		);
		worker.transformers = transformers;
		worker.updateLatestTransformers();
		const currentTransformers = worker.getLatestTransformers();

		expect(currentTransformers.length).toBe(3);
		expect(
			currentTransformers.some((tf) => {
				return tf.id === 'a1.1.0';
			}),
		).toBe(true);
		expect(
			currentTransformers.some((tf) => {
				return tf.id === 'a2.0.0';
			}),
		).toBe(true);
		expect(
			currentTransformers.some((tf) => {
				return tf.id === 'b1.0.0';
			}),
		).toBe(true);
	});
});
