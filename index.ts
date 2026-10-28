import React from 'react';
import 'react-native-get-random-values';
import { ExpoRoot } from 'expo-router';
import { registerRootComponent } from 'expo';

// Must be exported or Fast Refresh won't update the context
export function App() {
  const ctx = (require as any).context('./src/app');
  return React.createElement(ExpoRoot, { context: ctx });
}

registerRootComponent(App);
