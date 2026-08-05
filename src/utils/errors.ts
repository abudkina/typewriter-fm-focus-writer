/**
 * Пользовательские ошибки с русскими сообщениями.
 */
export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;

  constructor(code: string, userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return `Произошла ошибка: ${error.message}`;
  }
  return 'Произошла неизвестная ошибка. Попробуйте ещё раз.';
}
