require('@testing-library/jest-dom');

// Mock scrollIntoView which is not available in jsdom
// This runs in setupFilesAfterEnv, so Element may not be defined in node environment
beforeAll(() => {
  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = jest.fn();
  }
});
