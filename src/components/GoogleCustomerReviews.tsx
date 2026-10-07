import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    renderOptIn?: () => void;
    gapi?: {
      load: (name: string, callback: () => void) => void;
      surveyoptin: { render: (params: Record<string, unknown>) => void };
    };
  }
}

/**
 * Google Customer Reviews opt-in for the order confirmation page
 * (`/order-success/:id`).
 *
 * What this satisfies of Google's integration requirements:
 *  - "shopping cart & checkout hosted on the same domain"  -> both live under
 *    www.tradibu.com (the cart is in the site shell, checkout is /checkout).
 *  - "confirmation page on your own domain"                -> /order-success.
 *  - "<!DOCTYPE HTML> at the top of every webpage"         -> present in
 *    index.html and every prerendered /public page.
 *
 * The snippet's REQUIRED fields are all available on this page:
 *  - order_id          -> orders.id      (URL parameter)
 *  - email             -> authenticated buyer's email (supabase session)
 *  - delivery_country  -> orders.shipping_address->>'country'
 *  - estimated_delivery_date -> orders.estimated_delivery (YYYY-MM-DD)
 *
 * `products` (with GTIN) is optional in Google's snippet and is omitted here:
 * the products table has no GTIN/MPN column, so product-level identifiers
 * cannot be supplied yet. See the data-readiness note below.
 *
 * Note: this script is injected into the page *after* the buyer's order is
 * known, so it never renders on cart, login or any other page.
 */
export default function GoogleCustomerReviews() {
  const { id } = useParams<{ id: string }>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const { data: order } = await supabase
        .from('orders')
        .select('id, shipping_address, estimated_delivery')
        .eq('id', id)
        .single();

      if (cancelled || !order || !session?.user?.email) return;

      const shipping = order.shipping_address as Record<string, string> | null;
      const deliveryCountry = ((shipping && shipping.country) || '').trim().toUpperCase();

      const estimatedDelivery =
        order.estimated_delivery && !Number.isNaN(new Date(order.estimated_delivery).getTime())
          ? new Date(order.estimated_delivery).toISOString().slice(0, 10)
          : '';

      // Define the onload hook before the script tag so `onload=renderOptIn`
      // is guaranteed to resolve the moment platform.js finishes downloading.
      window.renderOptIn = function () {
        window.gapi?.load('surveyoptin', () => {
          window.gapi?.surveyoptin.render({
            merchant_id: '5859123831',
            order_id: order.id,
            email: session.user.email,
            delivery_country: deliveryCountry,
            estimated_delivery_date: estimatedDelivery,
          });
        });
      };

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/platform.js?onload=renderOptIn';
      script.async = true;
      document.head.appendChild(script);

      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="no-print" aria-live="polite">
      {ready ? null : <div className="sr-only">Google Customer Reviews: loading…</div>}
    </div>
  );
}
