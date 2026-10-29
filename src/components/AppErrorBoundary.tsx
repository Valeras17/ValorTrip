import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  clearLastFatalError,
  formatError,
  getLastFatalError,
  reportError,
  subscribeToErrors,
} from '@/lib/errorReporter';

// NOTE: uses plain StyleSheet (not NativeWind className) on purpose,
// so the error screen renders even if styling itself is broken.

interface ErrorScreenProps {
  error: Error;
  context?: string;
  componentStack?: string;
  onRetry?: () => void;
}

export function ErrorScreen({ error, context, componentStack, onRetry }: ErrorScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      {context ? <Text style={styles.context}>{context}</Text> : null}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.message} selectable>
          {formatError(error)}
        </Text>
        {componentStack ? (
          <>
            <Text style={styles.subtitle}>Component stack</Text>
            <Text style={styles.stack} selectable>
              {componentStack.trim()}
            </Text>
          </>
        ) : null}
      </ScrollView>
      {onRetry ? (
        <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface State {
  error: Error | null;
  context?: string;
  componentStack?: string;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = (() => {
    const last = getLastFatalError();
    return last ? { error: last.error, context: last.context } : { error: null };
  })();

  private unsubscribe?: () => void;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)), context: 'Render error' };
  }

  componentDidMount() {
    // Fatal errors thrown outside React rendering (global handler) are shown here too.
    this.unsubscribe = subscribeToErrors((report) => {
      if (report.fatal) {
        this.setState({ error: report.error, context: report.context, componentStack: undefined });
      }
    });
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? undefined });
    // Already visible on screen — log only, no Alert.
    reportError(error, 'Render error', { alert: false });
  }

  private handleRetry = () => {
    clearLastFatalError();
    this.setState({ error: null, context: undefined, componentStack: undefined });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          error={this.state.error}
          context={this.state.context}
          componentStack={this.state.componentStack}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0b0b',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: { color: '#f87171', fontSize: 22, fontWeight: '700' },
  context: { color: '#fca5a5', fontSize: 14, marginTop: 4 },
  scroll: { flex: 1, marginTop: 16 },
  scrollContent: { paddingBottom: 16 },
  message: { color: '#ffffff', fontSize: 13, fontFamily: 'monospace' },
  subtitle: { color: '#fca5a5', fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 4 },
  stack: { color: '#d4d4d8', fontSize: 11, fontFamily: 'monospace' },
  button: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
