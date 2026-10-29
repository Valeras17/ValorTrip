// Must be the very first import: installs global error handlers (Release builds have no red box).
import './src/lib/installErrorHandlers';
import React from 'react';
import 'react-native-get-random-values';
import { ExpoRoot } from 'expo-router';
import { registerRootComponent } from 'expo';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';

// Must be exported or Fast Refresh won't update the context
export function App() {
  const ctx = (require as any).context('./src/app');
  return React.createElement(
    AppErrorBoundary,
    null,
    React.createElement(ExpoRoot, { context: ctx })
  );
}

registerRootComponent(App);
