import type { Kernel } from 'autumndb';
import type { Pool } from 'pg';
import * as errors from './errors';
import { getNextExecutionDate, Worker } from './index';
import type { Transformer } from './transformers';

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
			{} as any as Pool,
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

describe('.getNextExecutionDate()', () => {
	test('should return expected date for one-time schedule', () => {
		const schedule = {
			once: {
				date: new Date(Date.now() + 60000),
			},
		};
		expect(getNextExecutionDate(schedule)).toEqual(schedule.once.date);
	});

	test('should return expected date for recurring schedule', () => {
		const now = new Date();
		const start = new Date(new Date().setMinutes(now.getMinutes() - 10));
		const end = new Date(new Date().setMinutes(now.getMinutes() + 30));

		const schedule = {
			recurring: {
				start,
				end,
				interval: '* * * * *',
			},
		};

		expect(getNextExecutionDate(schedule)).toEqual(
			new Date(new Date().setMinutes(now.getMinutes() + 1, 0, 0)),
		);
	});

	test('should return null for past one-time schedule', () => {
		const schedule = {
			once: {
				date: new Date(Date.now() - 60000),
			},
		};

		expect(getNextExecutionDate(schedule)).toBeNull();
	});

	test('should return null for recurring schedule with past end date', () => {
		const now = new Date();
		const start = new Date(new Date().setMinutes(now.getMinutes() - 30));
		const end = new Date(new Date().setMinutes(now.getMinutes() - 10));

		const schedule = {
			recurring: {
				start,
				end,
				interval: '* * * * *',
			},
		};

		expect(getNextExecutionDate(schedule)).toBeNull();
	});

	test('should return expected date for recurring schedule with future start date', () => {
		const now = new Date();
		const start = new Date(new Date().setFullYear(now.getFullYear() + 1));
		const end = new Date(new Date().setFullYear(now.getFullYear() + 2));

		const schedule = {
			recurring: {
				start,
				end,
				interval: '* * * * *',
			},
		};

		expect(getNextExecutionDate(schedule)).toEqual(
			new Date(new Date(start.getTime() + 60000).setSeconds(0, 0)),
		);
	});

	test('should return null for recurring schedule whose start date is after its end date', () => {
		const schedule = {
			recurring: {
				start: new Date(Date.now() - 60000),
				end: new Date(Date.now() - 120000),
				interval: '* * * * *',
			},
		};

		expect(getNextExecutionDate(schedule)).toBeNull();
	});

	test('should throw error on invalid schedule configuration', () => {
		expect(() => {
			getNextExecutionDate({
				recurring: {
					start: new Date(Date.now() - 120000),
					end: new Date(Date.now() + 120000),
					interval: 'a b c d e',
				},
			});
		}).toThrowError(errors.WorkerInvalidActionRequest);
	});
});
