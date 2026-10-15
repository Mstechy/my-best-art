import { describe, expect, it } from "vitest";
import { validateSellerProductCsv } from "@/lib/sellerProductCsv";

const fashion = { id: "fashion-id", name: "Fashion", slug: "fashion" };
const electronics = { id: "electronics-id", name: "Electronics", slug: "electronics" };
const headers = [
  "title", "description", "price", "currency", "stock_quantity", "category_slug", "product_type",
  "image_urls", "sku", "brand", "gtin", "mpn", "condition", "compare_at_price",
  "attr_brand", "attr_gender", "attr_size", "attr_color", "attr_material",
];

const row = (overrides: Record<string, string> = {}): Record<string, string> => ({
  title: "Everyday cotton shirt",
  description: "A comfortable cotton shirt with a relaxed fit, carefully finished seams, and an easy-care fabric for daily wear.",
  price: "25000",
  currency: "NGN",
  stock_quantity: "5",
  category_slug: "fashion",
  product_type: "t-shirts",
  image_urls: "https://cdn.example.com/shirt.jpg",
  sku: "SHIRT-001",
  brand: "Tradibu Basics",
  gtin: "",
  mpn: "",
  condition: "new",
  compare_at_price: "",
  attr_brand: "Tradibu Basics",
  attr_gender: "Unisex",
  attr_size: "M",
  attr_color: "Blue",
  attr_material: "Cotton",
  ...overrides,
});

const csvFor = (product: Record<string, string>) => {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return `${headers.join(",")}\r\n${headers.map((header) => escape(product[header] ?? "")).join(",")}`;
};
const csvForMany = (...products: Record<string, string>[]) => [
  headers.join(","),
  ...products.map((product) => headers.map((header) => `"${(product[header] ?? "").replace(/"/g, '""')}"`).join(",")),
].join("\r\n");

describe("validateSellerProductCsv", () => {
  it("accepts a valid listing and category-specific required specifications", () => {
    const result = validateSellerProductCsv(csvFor(row()), [fashion]);
    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      rowNumber: 2,
      categoryId: "fashion-id",
      productType: { key: "t-shirts" },
      attributes: { brand: "Tradibu Basics", gender: "Unisex", size: "M", color: "Blue", material: "Cotton" },
      imageUrls: ["https://cdn.example.com/shirt.jpg"],
    });
  });

  it("parses commas, escaped quotes, and line breaks inside quoted descriptions", () => {
    const description = 'A soft shirt, with a "comfortable" fit and durable cotton fabric.\nIt is suitable for everyday wear.';
    const result = validateSellerProductCsv(csvFor(row({ description })), [fashion]);
    expect(result.products[0]?.description).toBe(description);
  });

  it("reports missing category-required attributes against the exact row", () => {
    const phoneHeaders = [
      ...headers,
      "attr_model", "attr_storage", "attr_battery_health", "attr_operating_system", "attr_connectivity",
      "attr_network", "attr_sim_type", "attr_cosmetic_condition",
    ];
    const phoneRow = row({
      title: "Quality smartphone",
      category_slug: "electronics",
      product_type: "mobile-phones",
      attr_model: "Model A",
      attr_storage: "128GB",
      attr_color: "Black",
      attr_battery_health: "",
      attr_operating_system: "Android",
      attr_connectivity: "Wi-Fi + cellular mobile data",
      attr_network: "4G LTE",
      attr_sim_type: "Single physical SIM",
      attr_cosmetic_condition: "New / sealed",
    });
    const csv = `${phoneHeaders.join(",")}\r\n${phoneHeaders.map((header) => `"${phoneRow[header] ?? ""}"`).join(",")}`;
    const result = validateSellerProductCsv(csv, [electronics]);
    expect(result.products).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({ rowNumber: 2 });
    expect(result.errors[0]?.errors.join(" ")).toContain("attr_size");
    expect(result.errors[0]?.errors.join(" ")).toContain("attr_material");
  });

  it("rejects invalid images, non-positive prices, and fractional stock", () => {
    const result = validateSellerProductCsv(csvFor(row({
      price: "0",
      stock_quantity: "1.5",
      image_urls: "http://cdn.example.com/shirt.jpg",
    })), [fashion]);
    expect(result.errors[0]?.errors.join(" ")).toContain("greater than zero");
    expect(result.errors[0]?.errors.join(" ")).toContain("whole number");
    expect(result.errors[0]?.errors.join(" ")).toContain("HTTPS");
  });

  it("does not silently treat blank stock as zero", () => {
    const result = validateSellerProductCsv(csvFor(row({ stock_quantity: "" })), [fashion]);
    expect(result.products).toHaveLength(0);
    expect(result.errors[0]?.errors.join(" ")).toContain("Stock quantity");
  });

  it("rejects unsupported and repeated CSV columns before processing rows", () => {
    const productRow = row();
    const validData = headers.map((header) => productRow[header] ?? "").join(",");
    expect(() => validateSellerProductCsv(`${headers.join(",")},price\r\n${validData},25000`, [fashion]))
      .toThrow("duplicate column headings");
    expect(() => validateSellerProductCsv(`${headers.join(",")},unexpected\r\n${validData},value`, [fashion]))
      .toThrow("Unknown columns");
  });

  it("requires valid headers, well-formed quotes, and no more than 1,000 product rows", () => {
    expect(() => validateSellerProductCsv("title,price\r\n", [fashion])).toThrow("Missing required columns");
    expect(() => validateSellerProductCsv(`${headers.join(",")}\r\n"unfinished`, [fashion]))
      .toThrow("matching closing quote");
    expect(() => validateSellerProductCsv(`${headers.join(",")}\r\n${headers.map((header) => header === "title" ? '"Quoted"extra' : "x").join(",")}`, [fashion]))
      .toThrow("unexpected characters after a closing quote");
    const dataRow = headers.map(() => "x").join(",");
    expect(() => validateSellerProductCsv(`${headers.join(",")}\n${Array.from({ length: 1001 }, () => dataRow).join("\n")}`, [fashion]))
      .toThrow("up to 1000");
  });

  it("rejects repeated SKUs within an upload but allows rows without an SKU", () => {
    const result = validateSellerProductCsv(csvForMany(row(), row({ title: "A second shirt" })), [fashion]);
    expect(result.products).toHaveLength(1);
    expect(result.errors[0]?.errors.join(" ")).toContain('SKU "SHIRT-001" is repeated');

    const noSku = validateSellerProductCsv(csvFor(row({ sku: "" })), [fashion]);
    expect(noSku.products).toHaveLength(1);
    expect(noSku.products[0]?.sku).toBeNull();
  });
});
