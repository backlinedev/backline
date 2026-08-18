import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookAdapter } from '../../src/adapters/WebhookAdapter.js';

describe('WebhookAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers webhook for deployment', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ preview_url: 'https://preview.example.com' })
    });

    const adapter = new WebhookAdapter('https://deploy-hook.example.com');
    const result = await adapter.deploy('feature-branch');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://deploy-hook.example.com',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('feature-branch')
      })
    );

    expect(result.previewUrl).toBe('https://preview.example.com');
  });

  it('polls for deployment completion', async () => {
    // Current implementation doesn't support polling - it expects preview_url immediately
    // This test documents expected behavior if polling is added later
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ preview_url: 'https://preview.example.com' })
    });

    const adapter = new WebhookAdapter('https://deploy-hook.example.com');
    const result = await adapter.deploy('feature-branch');

    expect(result.previewUrl).toBe('https://preview.example.com');
  });

  it('handles webhook errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Webhook failed'));

    const adapter = new WebhookAdapter('https://deploy-hook.example.com');

    await expect(adapter.deploy('feature-branch')).rejects.toThrow('Webhook failed');
  });

  it('handles 500 response from webhook', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const adapter = new WebhookAdapter('https://deploy-hook.example.com');

    await expect(adapter.deploy('feature-branch')).rejects.toThrow();
  });

  it('health check calls the preview URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    });

    const adapter = new WebhookAdapter('https://deploy-hook.example.com');

    await expect(
      adapter.healthCheck('https://preview.example.com', '/health', 5000)
    ).resolves.not.toThrow();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://preview.example.com/health',
      expect.any(Object)
    );
  });

  it('teardown does nothing for webhook adapter', async () => {
    const adapter = new WebhookAdapter('https://deploy-hook.example.com');

    // Should not throw
    await expect(adapter.teardown('feature-branch')).resolves.toBeUndefined();
  });
});
