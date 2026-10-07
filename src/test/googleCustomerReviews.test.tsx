import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import GoogleCustomerReviews from '@/components/GoogleCustomerReviews';

// Mock the Supabase client at the module level so the component under test
// sees our fixture data (the real client speaks to the database).
vi.mock('@/integrations/supabase/client', () => {
  const session = { user: { email: 'buyer@tradibu.com' } };
  return {
    supabase: {
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session } })),
      },
      from: () => ({
        select: () => ({
          eq: vi.fn((_q, _id) => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  id: 'abc-123',
                  shipping_address: { country: '  nG  ' },
                  estimated_delivery: '2026-10-10T00:00:00.000Z',
                },
              })
            ),
          })),
        }),
      }),
    },
  };
});

/** Give the injected script's `onload=renderOptIn` hook a working gapi. */
function installGapi() {
  const renderSpy = vi.fn();
  const loadSpy = vi.fn((_name: string, callback: () => void) => {
    callback();
  });
  (window as unknown as { gapi: unknown }).gapi = {
    load: loadSpy,
    surveyoptin: { render: renderSpy },
  };
  return { loadSpy, renderSpy };
}

describe('GoogleCustomerReviews', () => {
  afterEach(() => {
    document.head
      .querySelectorAll('script[src*="platform.js"]')
      .forEach((s) => s.remove());
    delete (window as unknown as { renderOptIn?: () => void }).renderOptIn;
    delete (window as unknown as { gapi: unknown }).gapi;
    vi.clearAllMocks();
  });

  it('injects the Google platform script and renders the opt-in with this order', async () => {
    const { loadSpy, renderSpy } = installGapi();

    render(
      <MemoryRouter initialEntries={['/order-success/abc-123']}>
        <Routes>
          <Route
            path="/order-success/:id"
            element={<GoogleCustomerReviews />}
          />
        </Routes>
      </MemoryRouter>
    );

    // Wait until the order has been fetched and the onload hook defined.
    await waitFor(() =>
      expect(
        (window as unknown as { renderOptIn?: () => void }).renderOptIn
      ).toBeTypeOf('function')
    );

    const tag = document.head.querySelector('script[src*="platform.js"]');
    expect(tag).not.toBeNull();
    expect(tag?.getAttribute('src')).toContain('onload=renderOptIn');

    // jsdom never executes third-party scripts; fire the onload hook the way
    // platform.js would once it finishes downloading.
    (window as unknown as { renderOptIn: () => void }).renderOptIn();

    expect(loadSpy).toHaveBeenCalledWith('surveyoptin', expect.any(Function));
    expect(renderSpy).toHaveBeenCalledWith({
      merchant_id: '5859123831',
      order_id: 'abc-123',
      email: 'buyer@tradibu.com',
      delivery_country: 'NG',
      estimated_delivery_date: '2026-10-10',
    });

    // Once ready the component keeps only its (visually empty) container so
    // Google's popup can render — assert that container is mounted.
    const container = document.querySelector('[aria-live="polite"].no-print');
    expect(container).not.toBeNull();
  });

  it('does nothing when the URL carries no order id', async () => {
    render(
      <MemoryRouter initialEntries={['/order-success/']}>
        <GoogleCustomerReviews />
      </MemoryRouter>
    );

    // Give the component a chance to run its effect before asserting it bailed.
    await waitFor(() =>
      expect(
        document.head.querySelector('script[src*="platform.js"]')
      ).toBeNull()
    );
    expect(
      (window as unknown as { gapi: unknown }).gapi
    ).toBeUndefined();
  });
});