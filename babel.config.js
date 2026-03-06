module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: [
            '.ios.ts',
            '.android.ts',
            '.ts',
            '.ios.tsx',
            '.android.tsx',
            '.tsx',
            '.jsx',
            '.js',
            '.json',
          ],
          alias: {
            '@/components': './src/components',
            '@/hooks': './src/hooks',
            '@/lib': './src/lib',
            '@/screens': './src/screens',
            '@/stores': './src/stores',
            '@/types': './src/types',
            '@/theme': './src/theme',
            '@/services': './src/services',
            '@/schemas': './src/schemas',
            '@/navigation': './src/navigation',
            '@/contexts': './src/contexts',
            '@/utils': './src/utils',
          },
        },
      ],
    ],
  };
};
