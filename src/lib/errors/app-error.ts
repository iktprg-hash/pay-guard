import {
  getErrorDefinition,
  type AppErrorCode,
  type ErrorDefinition,
} from "@/lib/errors/codes";

export interface AppError<TDetails = unknown> {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly userMessage?: string;
  readonly statusCode: number;
  readonly details?: TDetails;
  readonly cause?: unknown;
}

export interface CreateAppErrorOptions<TDetails = unknown> {
  message?: string;
  userMessage?: string;
  statusCode?: number;
  details?: TDetails;
  cause?: unknown;
}

export class AppErrorImpl<TDetails = unknown>
  extends Error
  implements AppError<TDetails>
{
  readonly code: AppErrorCode;
  readonly userMessage?: string;
  readonly statusCode: number;
  readonly details?: TDetails;
  declare readonly cause?: unknown;

  constructor(
    code: AppErrorCode,
    definition: ErrorDefinition,
    options: CreateAppErrorOptions<TDetails> = {}
  ) {
    super(options.message ?? definition.message);
    this.name = "AppError";
    this.code = code;
    this.userMessage = options.userMessage;
    this.statusCode = options.statusCode ?? definition.statusCode;
    this.details = options.details;
    this.cause = options.cause;
  }
}

/** Factory for typed application errors. */
export function createAppError<TDetails = unknown>(
  code: AppErrorCode,
  options: CreateAppErrorOptions<TDetails> = {}
): AppError<TDetails> {
  return new AppErrorImpl(code, getErrorDefinition(code), options);
}
