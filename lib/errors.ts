import { TypedError } from 'typed-error';

export class BaseTypedError extends TypedError {}

export class WorkerAuthenticationError extends BaseTypedError {}
export class WorkerInvalidAction extends BaseTypedError {}
export class WorkerInvalidActionRequest extends BaseTypedError {}
export class WorkerInvalidDuration extends BaseTypedError {}
export class WorkerInvalidTemplate extends BaseTypedError {}
export class WorkerInvalidTrigger extends BaseTypedError {}
export class WorkerInvalidVersion extends BaseTypedError {}
export class WorkerNoElement extends BaseTypedError {}
export class WorkerNoExecuteEvent extends BaseTypedError {}
export class WorkerSchemaMismatch extends BaseTypedError {}
