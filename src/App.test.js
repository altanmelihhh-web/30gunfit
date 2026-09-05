import { render, screen } from '@testing-library/react';

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  })
}));

jest.mock('./firebase/config', () => ({
  auth: {},
  db: {},
  googleProvider: { addScope: jest.fn() }
}));

jest.mock('./firebase/authService', () => ({
  __esModule: true,
  registerWithEmail: jest.fn(() => Promise.resolve({ success: true })),
  loginWithEmail: jest.fn(() => Promise.resolve({ success: true })),
  handleGoogleRedirectResult: jest.fn(() => Promise.resolve(null)),
  logout: jest.fn(() => Promise.resolve({ success: true })),
  loginWithGoogle: jest.fn(() => Promise.resolve({ success: true })),
  resetPassword: jest.fn(() => Promise.resolve({ success: true })),
  getCurrentUser: jest.fn(() => null),
  default: {
    registerWithEmail: jest.fn(() => Promise.resolve({ success: true })),
    loginWithEmail: jest.fn(() => Promise.resolve({ success: true })),
    handleGoogleRedirectResult: jest.fn(() => Promise.resolve(null)),
    logout: jest.fn(() => Promise.resolve({ success: true })),
    loginWithGoogle: jest.fn(() => Promise.resolve({ success: true })),
    resetPassword: jest.fn(() => Promise.resolve({ success: true })),
    getCurrentUser: jest.fn(() => null)
  }
}));

jest.mock('./firebase/dataService', () => ({
  getAllUserData: jest.fn(),
  saveUserProfile: jest.fn(() => Promise.resolve({ success: true })),
  saveUserSettings: jest.fn(() => Promise.resolve({ success: true })),
  getDailyLogsRange: jest.fn(() => Promise.resolve({})),
  getCalorieTrackingRange: jest.fn(() => Promise.resolve({})),
  getWaterTracker: jest.fn(() => Promise.resolve({ success: true, data: { entries: [] } }))
}));

test('renders login gate after auth check', async () => {
  const App = require('./App').default;
  render(<App />);

  expect(await screen.findByText(/30 Gün Fit/i)).toBeInTheDocument();
  expect(screen.getByText(/giriş yapmanız gerekiyor/i)).toBeInTheDocument();
});
