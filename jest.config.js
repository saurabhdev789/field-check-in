module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|webp)$': '<rootDir>/__mocks__/fileMock.js',
  },
};
