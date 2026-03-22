import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup après chaque test
afterEach(() => {
  cleanup();
});

// Mock des variables d'environnement
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.FB_ACCESS_TOKEN = 'test-fb-token';
process.env.FB_APP_ID = '1557240932171719';
process.env.FB_PAGE_ID = '993561260499375';
process.env.TELEGRAM_BOT_TOKEN = 'test-telegram-token';
process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

// Mock global fetch
global.fetch = vi.fn();
