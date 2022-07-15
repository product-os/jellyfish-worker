import * as assert from '@balena/jellyfish-assert';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import { strict as nativeAssert } from 'assert';
import type { ContractData, Kernel } from 'autumndb';
import { parseExpression } from 'cron-parser';
import * as graphileWorker from 'graphile-worker';
import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
	QueueInvalidAction,
	QueueInvalidRequest,
	QueueNoRequest,
} from './errors';
import { wait } from './events';
import type {
	ActionRequestContract,
	ExecuteContract,
	ScheduledActionData,
} from '../types';

const logger = getLogger(__filename);

const GRAPHILE_RETRIES = 10;
const GRAPHILE_RETRY_DELAY = 1000;

export interface ProducerOptionsSchedule {
	contract: string;
	runAt: Date;
}

export interface ProducerOptions {
	logContext: LogContext;
	action: string;
	card: string;
	type: string;
	arguments: ContractData;
	currentDate?: Date;
	originator?: string;
	schedule?: ProducerOptionsSchedule;
}

export interface ProducerResults {
	error: boolean;
	timestamp: string;
	data: ExecuteContract['data']['payload']['data'];
}

export interface QueueProducer {
	initialize: (logContext: LogContext) => Promise<void>;
	waitResults: (
		logContext: LogContext,
		actionRequest: ActionRequestContract,
	) => Promise<ProducerResults>;
	deleteJob: (context: LogContext, key: string) => Promise<void>;
}

/**
 * Enqueing options, took from Graphile
 * See https://github.com/graphile/worker#addjob
 */
export interface ProducerEnqueueOptions {
	/**
	 * Flags for the job, can be used to dynamically filter which jobs can and
	 * cannot run at runtime. (Default: null)
	 * See forbiddenFlags on the graphile doc
	 */
	flags?: string[];
	/**
	 * Jobs are executed in numerically ascending order of priority (jobs with a
	 * numerically smaller priority are run first). (Default: 0)
	 */
	priority?: number;

	schedule?: ProducerOptionsSchedule;
}

/**
 * @summary Get the next execute date-time for a scheduled action
 *
 * @param schedule - schedule configuration
 * @returns next execution date, or null if no future date was found
 */
export function getNextExecutionDate(
	schedule: ScheduledActionData['schedule'],
): Date | null {
	const now = new Date();
	if (schedule.once) {
		// TS-TODO: Stop casting
		const next = new Date((schedule.once as any).date);
		if (next > now) {
			return (schedule.once as any).date;
		}
	} else if (schedule.recurring) {
		const endDate = new Date((schedule.recurring as any).end);
		const startDate = new Date((schedule.recurring as any).start);

		// Ignore anything that will have already ended
		if (endDate > now) {
			try {
				// Handle future start dates
				const options =
					startDate > now
						? {
								currentDate: startDate,
						  }
						: {
								startDate,
						  };

				// Create iterator based on provided configuration
				// TS-TODO: Stop casting
				const iterator = parseExpression((schedule.recurring as any).interval, {
					endDate,
					...options,
				});

				// Return next execution date if available
				if (iterator.hasNext()) {
					return iterator.next().toDate();
				}
			} catch (error) {
				throw new QueueInvalidAction(
					`Invalid recurring schedule configuration: ${error}`,
				);
			}
		}
	}

	return null;
}

/**
 * @summary Enqueue an action request
 * @function
 *
 * @param logContext - log context
 * @param pool - database connection pool
 * @param actor - actor id
 * @param actionRequest - action request contract
 * @param options - enqueueing options
 * @returns enqueued action request contract
 */
export async function enqueue(
	logContext: LogContext,
	pool: Pool,
	actor: string,
	actionRequest: ActionRequestContract,
	options?: ProducerEnqueueOptions,
): Promise<ActionRequestContract> {
	// Note that jobNames must be unique for each parameter combination
	let jobName = 'enqueue-action-request';
	const jobParameters: string[] = [`'actionRequest'`, '$1'];
	const values: any[] = [actionRequest];

	let nextParam = 2;
	if (options?.flags) {
		jobParameters.push('flags := $' + nextParam++);
		values.push(options.flags);
		jobName = jobName + '-flags';
	}

	if (options?.priority) {
		jobParameters.push('priority := $' + nextParam++);
		values.push(options.priority);
		jobName = jobName + '-prio';
	}

	// Handle scheduled actions
	if (options?.schedule) {
		jobName = jobName + uuidv4();
		jobParameters.push(
			'run_at := $' + nextParam++,
			'job_key := $' + nextParam++,
		);
		values.push(options.schedule.runAt, options.schedule.contract);
	}

	logger.info(logContext, 'Enqueueing action request', {
		options,
		jobParameters,
		values,
		actor,
		request: {
			slug: actionRequest.slug,
			action: actionRequest.data.action,
			card: actionRequest.data.card,
		},
	});

	await pool.query({
		name: jobName,
		text: `SELECT graphile_worker.add_job(${jobParameters.join(',')});`,
		values,
	});

	return actionRequest;
}

/**
 * Queue module for Jellyfish.
 *
 * @module queue
 */

export class Producer implements QueueProducer {
	constructor(
		private kernel: Kernel,
		private pool: Pool,
		private session: string,
	) {}

	/**
	 * @summary Initialize the queue producer
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 */
	async initialize(logContext: LogContext): Promise<void> {
		// Set up the graphile worker to ensure that the graphile_worker schema
		// exists in the DB before we attempt to enqueue a job.
		const workerUtils = await this.makeWorkerUtils(logContext);
		await workerUtils.release();
	}

	/**
	 * @summary Make and return Graphile worker utils instance
	 * @function
	 *
	 * @param logContext - log context
	 * @param retries - number of times to retry Graphile worker initialization
	 * @returns graphile worker utils instance
	 *
	 * @example
	 * ```typescript
	 * const workerUtils = await this.makeWorkerUtils(context);
	 * ```
	 */
	async makeWorkerUtils(
		logContext: LogContext,
		retries: number = GRAPHILE_RETRIES,
	): Promise<graphileWorker.WorkerUtils> {
		try {
			const workerUtils = await graphileWorker.makeWorkerUtils({
				pgPool: this.pool,
			});
			return workerUtils;
		} catch (error) {
			if (retries > 0) {
				logger.info(logContext, 'Graphile worker failed to run', {
					retries,
					error,
				});
				await new Promise((resolve) => {
					setTimeout(resolve, GRAPHILE_RETRY_DELAY);
				});
				return this.makeWorkerUtils(logContext, retries - 1);
			}
			throw error;
		}
	}

	/**
	 * @summary Wait for an action request results
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param actionRequest - action request contract
	 * @returns producer results
	 */
	async waitResults(
		logContext: LogContext,
		actionRequest: ActionRequestContract,
	): Promise<ProducerResults> {
		logger.info(logContext, 'Waiting request results', {
			request: {
				id: actionRequest.id,
				slug: actionRequest.slug,
				card: actionRequest.data.input.id,
				type: actionRequest.data.input.type,
				actor: actionRequest.data.actor,
				action: actionRequest.data.action,
			},
		});

		const request = await wait(logContext, this.kernel, this.session, {
			id: actionRequest.id,
			actor: actionRequest.data.actor,
		});

		logger.info(logContext, 'Got request results', {
			request: {
				id: actionRequest.id,
				slug: actionRequest.slug,
				card: actionRequest.data.input.id,
				type: actionRequest.data.input.type,
				actor: actionRequest.data.actor,
				action: actionRequest.data.action,
			},
		});

		nativeAssert(
			request,
			new QueueNoRequest(
				`Request not found: ${JSON.stringify(actionRequest, null, 2)}`,
			),
		);
		assert.INTERNAL(
			logContext,
			request.data.payload,
			QueueInvalidRequest,
			() => {
				return `Execute event has no payload: ${JSON.stringify(
					request,
					null,
					2,
				)}`;
			},
		);

		return {
			error: request.data.payload.error,
			timestamp: request.data.payload.timestamp,
			data: request.data.payload.data,
		};
	}

	/**
	 * @summary Delete a job from the queue using its job key
	 * @function
	 *
	 * @param logContext - execution context
	 * @param key - job key to delete
	 */
	async deleteJob(logContext: LogContext, key: string): Promise<void> {
		logger.debug(logContext, 'Deleting job from queue', {
			key,
		});

		await this.pool.query({
			text: `SELECT graphile_worker.remove_job($1);`,
			values: [key],
		});
	}
}
