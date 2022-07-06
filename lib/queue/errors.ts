import { TypedError } from 'typed-error';
import type { JellyfishError } from '../types';

export class BaseTypedError extends TypedError implements JellyfishError {
	expected: boolean = false;
}

export class QueueInvalidAction extends BaseTypedError {}
export class QueueInvalidRequest extends BaseTypedError {}
export class QueueInvalidSession extends BaseTypedError {}
export class QueueNoRequest extends BaseTypedError {}
export class QueueServiceError extends BaseTypedError {}
