const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jsdom', // Use jsdom for React component testing
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  transformIgnorePatterns: [
    'node_modules/(?!(superjson|copy-anything|is-what|nanoid|msw|msw-trpc|@testing-library|@tiptap|@radix-ui|@trpc)/)'
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
  // Use different environments for different test types
  projects: [
    {
      displayName: 'client',
      testMatch: ['<rootDir>/src/components/**/*.test.{js,jsx,ts,tsx}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'server',
      testMatch: [
        '<rootDir>/src/server/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/__tests__/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/lib/**/*.test.{js,jsx,ts,tsx}'
      ],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(superjson|copy-anything|is-what|nanoid|msw|msw-trpc|@testing-library|@tiptap|@radix-ui|@trpc)/)'
      ],
    }
  ]
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)