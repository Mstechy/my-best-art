import { getProductTypesForCategory, getRequiredFields, type ProductTypeConfig } from "@/lib/categoryConfig";
import { isValidGtin } from "@/lib/googleFeed";
import { LISTING_CURRENCIES } from "@/lib/sellerListing/listingForm";

const REQUIRED_HEADERS = ["title", "description", "price", "stock_quantity", "category_slug", "product_type", "image_urls"];
const MAX_PRODUCT_ROWS = 1000;
const MAX_IMAGES = 12;
const OPTIONAL_HEADERS = [
  "currency", "sku", "brand", "gtin", "mpn", "condition", "compare_at_price",
];
export const CSV_IGNORE_COLUMN = "__ignore__";
export const CSV_UNMAPPED_COLUMN = "__unmapped__";
export const CSV_MAPPABLE_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

const HEADER_ALIASES: Record<string, string[]> = {
  title: ["product_name", "product_title", "item_name", "item_title", "name"],
  description: ["product_description", "product_details", "details", "long_description"],
  price: ["selling_price", "sale_price", "unit_price", "current_price"],
  currency: ["currency_code", "price_currency"],
  stock_quantity: ["stock", "inventory", "quantity", "available_stock"],
  category_slug: ["category", "category_name", "department", "department_name"],
  product_type: ["product_type_key", "product_type_name", "type", "item_type"],
  image_urls: ["image_url", "images", "photos", "photo_urls", "product_images"],
  sku: ["seller_sku", "product_sku", "item_sku", "item_code", "code"],
  brand: ["manufacturer", "maker", "brand_name"],
  gtin: ["barcode", "ean", "upc", "isbn"],
  mpn: ["model_number", "part_number", "manufacturer_part_number"],
  condition: ["item_condition", "product_condition"],
  compare_at_price: ["original_price", "regular_price", "msrp", "compare_price"],
};

export interface CsvCategory {
  id: string;
  name: string;
  slug: string;
}

export interface CsvProduct {
  rowNumber: number;
  title: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  stockQuantity: number;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  productType: ProductTypeConfig;
  imageUrls: string[];
  sku: string | null;
  brand: string | null;
  gtin: string | null;
  mpn: string | null;
  condition: "new" | "used" | "refurbished";
  attributes: Record<string, string>;
}

export interface CsvRowError {
  rowNumber: number;
  title: string;
  errors: string[];
}

export interface CsvValidationResult {
  products: CsvProduct[];
  errors: CsvRowError[];
}

function parseRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (closedQuote && character !== "," && character !== "\n" && character !== "\r" && character !== " " && character !== "\t") {
      throw new Error("The CSV has unexpected characters after a closing quote.");
    } else if (character === '"' && cell.length === 0 && !closedQuote) {
      quoted = true;
    } else if (character === '"' && !closedQuote) {
      throw new Error("The CSV has a quote inside an unquoted value.");
    } else if (character === ",") {
      record.push(cell);
      cell = "";
      closedQuote = false;
    } else if (character === "\n" || character === "\r") {
      record.push(cell);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      cell = "";
      closedQuote = false;
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
    } else if (closedQuote) {
      continue;
    } else {
      cell += character;
    }
    if (!quoted && character === '"' && !closedQuote) closedQuote = true;
  }

  if (quoted) throw new Error("The CSV has an opening quote without a matching closing quote.");
  record.push(cell);
  if (record.some((value) => value.trim())) records.push(record);
  return records;
}

export function normalizeSellerProductCsvHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[\s-]+/g, "_");
}

export type CsvColumnMapping = Record<string, string>;

export function getSellerProductCsvHeaders(csv: string): string[] {
  const records = parseRecords(csv.replace(/^\uFEFF/, ""));
  return records[0]?.map(normalizeSellerProductCsvHeader) ?? [];
}

export function suggestSellerProductCsvMapping(headers: string[]): CsvColumnMapping {
  const aliases = new Map(Object.entries(HEADER_ALIASES).flatMap(([canonical, values]) => values.map((alias) => [alias, canonical] as const)));
  return Object.fromEntries(headers.map((header) => [
    header,
    CSV_MAPPABLE_HEADERS.includes(header) || header.startsWith("attr_")
      ? header
      : aliases.get(header) || CSV_UNMAPPED_COLUMN,
  ]));
}

function attributeHeader(key: string): string {
  return `attr_${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`;
}

function parsePositivePrice(value: string): number | null {
  const amount = Number(value.trim());
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function categoryFor(value: string, categories: CsvCategory[]): CsvCategory | undefined {
  const normalized = value.trim().toLowerCase();
  return categories.find((category) =>
    category.slug.toLowerCase() === normalized || category.name.trim().toLowerCase() === normalized
  );
}

function productTypeFor(category: CsvCategory, value: string): ProductTypeConfig | undefined {
  const normalized = value.trim().toLowerCase();
  return getProductTypesForCategory(category).find((type) =>
    type.key.toLowerCase() === normalized || type.label.trim().toLowerCase() === normalized
  );
}

export function validateSellerProductCsv(csv: string, categories: CsvCategory[], columnMapping: CsvColumnMapping = {}): CsvValidationResult {
  const records = parseRecords(csv.replace(/^\uFEFF/, ""));
  if (records.length === 0) throw new Error("Add a header row and at least one product row to the CSV.");
  if (records.length - 1 > MAX_PRODUCT_ROWS) {
    throw new Error(`A single import can contain up to ${MAX_PRODUCT_ROWS} product rows. Split larger catalogs into separate CSV files.`);
  }

  const sourceHeaders = records[0].map(normalizeSellerProductCsvHeader);
  const blankHeaders = sourceHeaders.some((header) => !header);
  if (blankHeaders) throw new Error("Every CSV column needs a heading. Remove any unnamed columns.");
  const duplicateHeaders = sourceHeaders.filter((header, index) => sourceHeaders.indexOf(header) !== index);
  if (duplicateHeaders.length > 0) throw new Error(`The CSV contains duplicate column headings: ${[...new Set(duplicateHeaders)].join(", ")}.`);
  const mappedHeaders = sourceHeaders.map((header) => columnMapping[header] || header);
  const activeColumnIndexes = mappedHeaders.flatMap((header, index) => header === CSV_IGNORE_COLUMN ? [] : [index]);
  const headers = activeColumnIndexes.map((index) => mappedHeaders[index]);
  const unresolvedHeaders = headers.filter((header) => header === CSV_UNMAPPED_COLUMN);
  if (unresolvedHeaders.length > 0) throw new Error("Map every unfamiliar CSV column to a Tradibu field or choose Ignore before previewing.");
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) throw new Error(`Missing required columns: ${missingHeaders.join(", ")}.`);
  if (headers.some((header) => header.startsWith("attr_") && header.length === 5)) {
    throw new Error("Attribute columns need a name, for example attr_brand or attr_storage.");
  }
  const unknownHeaders = headers.filter((header) =>
    !REQUIRED_HEADERS.includes(header) && !OPTIONAL_HEADERS.includes(header) && !header.startsWith("attr_")
  );
  if (unknownHeaders.length > 0) {
    throw new Error(`Unknown columns: ${unknownHeaders.join(", ")}. Use attr_fieldname for category specifications.`);
  }
  if (records.length < 2) throw new Error("Add at least one product row below the CSV header.");

  const products: CsvProduct[] = [];
  const errors: CsvRowError[] = [];
  const skusInFile = new Set<string>();

  records.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const row = Object.fromEntries(activeColumnIndexes.map((sourceColumn, activeColumn) => [headers[activeColumn], (cells[sourceColumn] ?? "").trim()]));
    const rowErrors: string[] = [];
    if (cells.length > sourceHeaders.length) rowErrors.push("This row has more values than the header. Check for unescaped commas in cell values.");
    const title = row.title ?? "";
    if (!title) rowErrors.push("Add a product title.");
    if (title.length > 200) rowErrors.push("Product titles must be 200 characters or fewer.");
    if (!row.description || row.description.length < 80) rowErrors.push("Description must contain at least 80 characters.");
    if (row.description.length > 5000) rowErrors.push("Description must be 5,000 characters or fewer.");

    const price = parsePositivePrice(row.price ?? "");
    if (price === null) rowErrors.push("Price must be a number greater than zero.");
    const compareAtPrice = row.compare_at_price ? parsePositivePrice(row.compare_at_price) : null;
    if (row.compare_at_price && (compareAtPrice === null || (price !== null && compareAtPrice <= price))) {
      rowErrors.push("Compare-at price must be a valid amount greater than the product price.");
    }
    const stockQuantity = Number(row.stock_quantity);
    if (!row.stock_quantity || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      rowErrors.push("Stock quantity must be a whole number of zero or more.");
    }

    const currency = (row.currency || "NGN").toUpperCase();
    if (!LISTING_CURRENCIES.includes(currency)) rowErrors.push(`Currency "${currency}" is not supported.`);

    const category = categoryFor(row.category_slug ?? "", categories);
    if (!category) rowErrors.push(`Category "${row.category_slug || "(blank)"}" was not found. Use a category name or slug from the template instructions.`);
    const productType = category ? productTypeFor(category, row.product_type ?? "") : undefined;
    if (category && !productType) {
      rowErrors.push(`Product type "${row.product_type || "(blank)"}" is not available for ${category.name}.`);
    }

    const imageUrls = [...new Set((row.image_urls ?? "").split("|").map((url) => url.trim()).filter(Boolean))];
    if (imageUrls.length === 0) rowErrors.push("Add at least one public HTTPS image URL.");
    if (imageUrls.length > MAX_IMAGES) rowErrors.push(`Use no more than ${MAX_IMAGES} image URLs per product.`);
    if (imageUrls.some((value) => {
      try {
        const url = new URL(value);
        return url.protocol !== "https:" || !url.hostname || !/^https:\/\//i.test(value);
      } catch {
        return true;
      }
    })) rowErrors.push("Every image must be a valid absolute HTTPS URL.");

    const attributes: Record<string, string> = {};
    activeColumnIndexes.forEach((sourceColumn, activeColumn) => {
      const header = headers[activeColumn];
      if (header.startsWith("attr_") && cells[sourceColumn]?.trim()) {
        const suppliedKey = header.slice(5);
        const canonicalKey = productType?.fields.find((field) =>
          field.key.toLowerCase().replace(/_/g, "") === suppliedKey.replace(/_/g, "")
        )?.key ?? suppliedKey;
        attributes[canonicalKey] = cells[sourceColumn].trim();
      }
    });
    const brand = row.brand || attributes.brand || "";
    const conditionValue = (row.condition || attributes.condition || "new").toLowerCase();
    const condition: CsvProduct["condition"] = conditionValue === "used" || conditionValue === "refurbished" ? conditionValue : "new";
    if (!["new", "used", "refurbished"].includes(conditionValue)) {
      rowErrors.push("Condition must be new, used, or refurbished.");
    }
    if (brand && !attributes.brand && productType?.fields.some((field) => field.key === "brand")) attributes.brand = brand;
    if (!attributes.condition && productType?.fields.some((field) => field.key === "condition")) attributes.condition = conditionValue;

    if (productType) {
      const allowedAttributes = new Set(productType.fields.map((field) => field.key));
      const unknownAttributes = Object.keys(attributes).filter((key) => !allowedAttributes.has(key));
      if (unknownAttributes.length > 0) {
        rowErrors.push(`These attributes do not apply to ${productType.label}: ${unknownAttributes.map((key) => `attr_${key}`).join(", ")}.`);
      }
      const missingRequired = getRequiredFields(productType).filter((key) => !attributes[key]?.trim());
      if (missingRequired.length > 0) {
        rowErrors.push(`Required ${productType.label} details are missing: ${missingRequired.map(attributeHeader).join(", ")}.`);
      }
    }

    const gtin = row.gtin || "";
    if (gtin && !isValidGtin(gtin)) rowErrors.push("GTIN must be a valid 8, 12, 13, or 14 digit code.");
    const sku = row.sku || "";
    if (sku) {
      const normalizedSku = sku.toLowerCase();
      if (skusInFile.has(normalizedSku)) rowErrors.push(`SKU "${sku}" is repeated in this CSV.`);
      skusInFile.add(normalizedSku);
    }

    if (rowErrors.length > 0) {
      errors.push({ rowNumber, title: title || "(untitled product)", errors: rowErrors });
      return;
    }
    if (!category || !productType || price === null) return;

    products.push({
      rowNumber,
      title,
      description: row.description,
      price,
      compareAtPrice,
      currency,
      stockQuantity,
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      productType,
      imageUrls,
      sku: sku || null,
      brand: brand || null,
      gtin: gtin || null,
      mpn: row.mpn || null,
      condition,
      attributes,
    });
  });

  return { products, errors };
}

export const SELLER_PRODUCT_CSV_TEMPLATE = [
  "title,description,price,currency,stock_quantity,category_slug,product_type,image_urls,sku,brand,gtin,mpn,condition,compare_at_price,attr_brand,attr_color,attr_material",
  "",
].join("\r\n");

export const SELLER_PRODUCT_CSV_GUIDE = [
  "Required columns: title, description, price, stock_quantity, category_slug, product_type, image_urls.",
  "Use category name/slug and product type key/label shown in the seller listing form. Common spreadsheet headers such as product_name, barcode, stock, and images are mapped during preview.",
  "Add category-specific specifications as attr_fieldname columns, for example attr_color or attr_storage.",
  "Separate multiple image URLs with |. Images must be public HTTPS URLs.",
  "Descriptions must be 80-5000 characters. Currency defaults to NGN; condition defaults to new.",
  "Use a unique SKU per product. If blank, Tradibu generates a stable SKU from the product content and image, so re-uploading the unchanged CSV is safe.",
  "One row is one single-price listing; SKU variant matrices must be created in the product form.",
  "Rows are imported atomically with their images and enter the normal admin approval queue. Re-importing unchanged rows is safe; edit changed listings from My Products.",
].join("\r\n");
