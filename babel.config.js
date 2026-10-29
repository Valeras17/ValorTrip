module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4: without these two entries every `className` is silently ignored
      // (layout collapses -> blank/grey screen).
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
