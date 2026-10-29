import { Alert } from 'react-native';

/**
 * Minimal error reporter that works in Release builds (no red box there).
 * - Fatal errors are pushed to subscribers (AppErrorBoundary renders them on screen).
 * - Every error is also shown in an Alert so nothing goes unnoticed.
 */

export interface ReportedError {
  error: Error;
  context?: string;
  fatal: boolean;
}

type Listener = (report: ReportedError) => void;

const listeners = new Set<Listener>();
let lastFatal: ReportedError | null = null;
let handlersInstalled = false;

export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

export function formatError(error: Error): string {
  const stack = (error.stack ?? '').split('\n').slice(0, 15).join('\n');
  return `${error.name}: ${error.message}${stack ? `\n\n${stack}` : ''}`;
}

export function reportError(
  value: unknown,
  context?: string,
  options: { fatal?: boolean; alert?: boolean } = {}
): void {
  const { fatal = false, alert = true } = options;
  const error = toError(value);
  const report: ReportedError = { error, context, fatal };

  console.error(`[ValorTrip]${context ? ` [${context}]` : ''}`, error);

  if (fatal) lastFatal = report;
  listeners.forEach((listener) => {
    try {
      listener(report);
    } catch {
      // never let a listener break error reporting
    }
  });

  if (alert) {
    try {
      Alert.alert(context ? `Ошибка: ${context}` : 'Ошибка', formatError(error).slice(0, 1500));
    } catch {
      // Alert may be unavailable before the Activity is ready
    }
  }
}

export function subscribeToErrors(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLastFatalError(): ReportedError | null {
  return lastFatal;
}

export function clearLastFatalError(): void {
  lastFatal = null;
}

/** Installs global JS error + unhandled promise rejection handlers. Safe to call multiple times. */
export function installGlobalErrorHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;

  const g = globalThis as any;

  const errorUtils = g.ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const previousHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      reportError(error, isFatal ? 'Fatal JS error' : 'JS error', { fatal: !!isFatal });
      // In Release the default fatal handler kills the app; skip it so the error stays visible.
      if (previousHandler && (__DEV__ || !isFatal)) {
        previousHandler(error, isFatal);
      }
    });
  }

  try {
    g.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id: number, rejection: unknown) => {
        reportError(rejection, 'Unhandled promise rejection');
      },
    });
  } catch {
    // Promise rejection tracking is optional
  }
}
