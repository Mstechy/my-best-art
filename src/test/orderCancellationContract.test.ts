import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

describe("buyer order cancellation contract", () => {
  it("keeps cancellation behind the authenticated, buyer-scoped RPC", () => {
    const orders = read("src/pages/buyer/BuyerOrders.tsx");
    const migration = read("supabase/migrations/20261118120000_restore_buyer_order_cancellation_rpc.sql");
    const types = read("src/integrations/supabase/types.ts");

    expect(orders).toContain('rpc("request_buyer_order_cancellation"');
    expect(orders).toContain("p_order_id: cancelOrder.id");
    expect(orders).toContain("p_reason: cancelReason.trim()");
    expect(migration).toContain("buyer_id = auth.uid()");
    expect(migration).toContain("Only orders awaiting seller confirmation can be cancelled");
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
    expect(types).toContain("request_buyer_order_cancellation");
  });
});
