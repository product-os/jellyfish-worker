import { TypedError } from 'typed-error';
import { JellyfishError } from './types/index';
export * from './sync/errors';

export class WorkerAuthenticationError extends TypedError {}
export class WorkerInvalidAction extends TypedError {}
export class WorkerInvalidActionRequest extends TypedError {}
export class WorkerInvalidDuration extends TypedError {}
export class WorkerInvalidTemplate extends TypedError {}
export class WorkerInvalidTrigger extends TypedError {}
export class WorkerInvalidVersion extends TypedError {}
export class WorkerNoElement extends TypedError {}
export class WorkerNoExecuteEvent extends TypedError {}
export class WorkerSchemaMismatch extends TypedError {}

export class RetriesExhaustedError extends Error implements JellyfishError {
	expected: boolean = false;
}
