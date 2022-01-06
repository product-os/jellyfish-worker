import { TypedError } from 'typed-error';
import { JellyfishErrorConstructor } from '@balena/jellyfish-types/build/error';

export interface WorkerErrors {
	WorkerNoExecuteEvent: JellyfishErrorConstructor;
	WorkerNoElement: JellyfishErrorConstructor;
	WorkerInvalidVersion: JellyfishErrorConstructor;
	WorkerInvalidAction: JellyfishErrorConstructor;
	WorkerInvalidActionRequest: JellyfishErrorConstructor;
	WorkerInvalidTrigger: JellyfishErrorConstructor;
	WorkerInvalidTemplate: JellyfishErrorConstructor;
	WorkerInvalidDuration: JellyfishErrorConstructor;
	WorkerSchemaMismatch: JellyfishErrorConstructor;
	WorkerAuthenticationError: JellyfishErrorConstructor;
}

export class WorkerNoExecuteEvent extends TypedError {}
export class WorkerNoElement extends TypedError {}
export class WorkerInvalidVersion extends TypedError {}
export class WorkerInvalidAction extends TypedError {}
export class WorkerInvalidActionRequest extends TypedError {}
export class WorkerInvalidTrigger extends TypedError {}
export class WorkerInvalidTemplate extends TypedError {}
export class WorkerInvalidDuration extends TypedError {}
export class WorkerSchemaMismatch extends TypedError {}
export class WorkerAuthenticationError extends TypedError {}
