import js from '@eslint/js';
import globals from 'globals';

// Globals provided by GJS (both processes) and by gnome-shell (shell process only).
const gjsGlobals = {
    ARGV: 'readonly',
    imports: 'readonly',
    log: 'readonly',
    logError: 'readonly',
    print: 'readonly',
    printerr: 'readonly',
    console: 'readonly',
    TextDecoder: 'readonly',
    TextEncoder: 'readonly',
};

export default [
    { ignores: ['dist/', 'node_modules/'] },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: gjsGlobals,
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
            // TODO: promote to 'error' once the open PRs touching these lines (#21, #22) are merged.
            'prefer-const': 'warn',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],
        },
    },
    {
        // Shell process: may use the gnome-shell `global` object.
        files: ['extension.js', 'indicatorSettings.js'],
        languageOptions: { globals: { global: 'readonly' } },
    },
    {
        files: ['eslint.config.js'],
        languageOptions: { globals: globals.node },
    },
];
