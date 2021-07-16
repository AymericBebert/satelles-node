module.exports = {
    root: true,
    env: {
        node: true
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module'
    },
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking'
    ],
    rules: {
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/quotes': [
            'error',
            'single'
        ],
        '@typescript-eslint/no-misused-promises': [
            'error',
            {
                checksVoidReturn: false
            }
        ],
        'semi': [
            2,
            'always'
        ]
    },
};
