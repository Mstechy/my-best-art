-- Checkout orders and line items must be created by the trusted marketplace RPC.
-- The original buyer INSERT policies allowed a client to bypass server-side
-- pricing, shipping, inventory, and payment invariants before Paystack payment.

DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can insert order items" ON public.order_items;

-- Keep table-level privileges aligned with the RLS intent. The SECURITY DEFINER
-- checkout functions run as their owner and are not affected by these revokes.
REVOKE INSERT ON public.orders FROM anon, authenticated;
REVOKE INSERT ON public.order_items FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
