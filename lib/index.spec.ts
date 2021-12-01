import { Worker } from './index';
import { Transformer } from './transformers';
import * as queue from '@balena/jellyfish-queue';
import { Kernel } from '@balena/jellyfish-core/build/kernel';

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
			{
				id: 'b0.0.1',
				slug: 'b-transformer',
				version: '0.0.1',
			},
		] as Transformer[];

		// TS-TODO: is there a better way to instantiate a simple Worker?
		const worker = new Worker(
			{} as any as Kernel,
			'session-foo',
			{},
			{} as any as queue.Consumer,
			{} as any as queue.Producer,
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
