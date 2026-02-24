const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const UNIQUE = `pw_test_${Date.now()}`;

test.describe('Chat App E2E', () => {

  test('a) Auth page loads with heading and login form', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('.auth-header h1')).toHaveText('Chat');
    await expect(page.locator('input[placeholder="Username"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();
  });

  test('b) Switch to Create Account mode', async ({ page }) => {
    await page.goto(BASE);
    await page.click('button.auth-switch');
    await expect(page.locator('input[placeholder="First name"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Last name"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Email"]')).toBeVisible();
  });

  test('c) Create a test account', async ({ page }) => {
    await page.goto(BASE);
    await page.click('button.auth-switch');
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="First name"]', 'Test');
    await page.fill('input[placeholder="Last name"]', 'User');
    await page.fill('input[placeholder="Email"]', 'test@test.com');
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('button.auth-switch')).toHaveText('Create an account', { timeout: 10000 });
  });

  test('d) Log in with the created account', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });
  });

  test('e) Chat page loads with sidebar elements', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.sidebar-title')).toContainText('Chat');
    await expect(page.locator('button', { hasText: 'New Chat' })).toBeVisible();
    await expect(page.locator('.sidebar-footer .sidebar-username')).toHaveText('Test User');
  });

  test('f) Two tabs exist: Chat and YouTube Channel Download', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });

    const chatTab = page.locator('button.chat-tab-btn', { hasText: 'Chat' });
    const ytTab = page.locator('button.chat-tab-btn', { hasText: 'YouTube Channel Download' });
    await expect(chatTab).toBeVisible();
    await expect(ytTab).toBeVisible();
  });

  test('g) YouTube Channel Download tab shows form', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });

    await page.click('button.chat-tab-btn >> text=YouTube Channel Download');
    await expect(page.locator('input[type="url"][placeholder*="youtube"]')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.locator('button.yt-download-btn')).toBeVisible();
    await expect(page.locator('button.yt-download-btn')).toHaveText('Download Channel Data');
  });

  test('h) Click back to Chat tab — chat input visible', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });

    await page.click('button.chat-tab-btn >> text=YouTube Channel Download');
    await expect(page.locator('.yt-download')).toBeVisible();
    await page.click('button.chat-tab-btn >> text=Chat');
    await expect(page.locator('.chat-input-area')).toBeVisible();
    await expect(page.locator('.chat-input-row input[type="text"]')).toBeVisible();
  });

  test('i) File picker accepts JSON', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });

    const fileInput = page.locator('input[type="file"]');
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toContain('.json');
  });

  test('j) Upload JSON file shows JSON chip in chat', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });

    const fileInput = page.locator('input[type="file"]');
    const path = require('path');
    const jsonPath = path.resolve(__dirname, '..', 'public', 'veritasium_channel_10.json');
    await fileInput.setInputFiles(jsonPath);

    const jsonChip = page.locator('.csv-chip', { hasText: 'videos' });
    await expect(jsonChip).toBeVisible({ timeout: 5000 });
    await expect(jsonChip).toContainText('10 videos');
  });

  test('k) Veritasium sample JSON is accessible from public folder', async ({ page }) => {
    const res = await page.goto(`${BASE}/veritasium_channel_10.json`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.channel_title).toBe('Veritasium');
    expect(json.videos).toHaveLength(10);
    expect(json.videos[0]).toHaveProperty('view_count');
    expect(json.videos[0]).toHaveProperty('like_count');
    expect(json.videos[0]).toHaveProperty('comment_count');
    expect(json.videos[0]).toHaveProperty('published_at');
    expect(json.videos[0]).toHaveProperty('title');
    expect(json.videos[0]).toHaveProperty('video_url');
    expect(json.videos[0]).toHaveProperty('thumbnail_url');
    expect(json.videos[0]).toHaveProperty('duration_seconds');
  });

  test('l) JSON chip can be removed', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });

    const fileInput = page.locator('input[type="file"]');
    const path = require('path');
    const jsonPath = path.resolve(__dirname, '..', 'public', 'veritasium_channel_10.json');
    await fileInput.setInputFiles(jsonPath);

    const jsonChip = page.locator('.csv-chip', { hasText: 'videos' });
    await expect(jsonChip).toBeVisible({ timeout: 5000 });

    await page.click('.csv-chip-remove');
    await expect(jsonChip).not.toBeVisible();
  });

  test('m) Drop overlay text mentions JSON', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });

    const chatMsgs = page.locator('.chat-messages');
    await chatMsgs.dispatchEvent('dragover');
    const overlay = page.locator('.chat-drop-overlay');
    await expect(overlay).toBeVisible({ timeout: 2000 });
    await expect(overlay).toContainText('JSON');
  });

  test('n) Log out returns to auth page', async ({ page }) => {
    await page.goto(BASE);
    await page.fill('input[placeholder="Username"]', UNIQUE);
    await page.fill('input[placeholder="Password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page.locator('aside.chat-sidebar')).toBeVisible({ timeout: 10000 });

    await page.click('button.sidebar-logout');
    await expect(page.locator('.auth')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.auth-header h1')).toHaveText('Chat');
  });

});
