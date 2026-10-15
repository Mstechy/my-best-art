import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getProductTypesForCategory, getRequiredFields } from "@/lib/categoryConfig";
import { SELLER_PRODUCT_CSV_GUIDE, SELLER_PRODUCT_CSV_TEMPLATE, validateSellerProductCsv, type CsvCategory, type CsvProduct, type CsvRowError } from "@/lib/sellerProductCsv";

type ImportStatus = "ready" | "imported" | "error";
type ImportRow = { product: CsvProduct; status: ImportStatus; error?: string; sku?: string };

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const BATCH_SIZE = 20;
const toAttributeColumn = (key: string) => `attr_${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`;

function productSkuIdentity(product: CsvProduct): string {
  return [
    product.title.toLowerCase().trim(),
    product.description.toLowerCase().trim(),
    product.categorySlug.toLowerCase(),
    product.productType.key.toLowerCase(),
    (product.brand ?? "").toLowerCase().trim(),
    product.gtin ?? "",
    product.imageUrls[0] ?? "",
  ].join("\u001f");
}

function downloadFile(name: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function categoryReferenceCsv(categories: CsvCategory[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const records = [
    ["category_slug", "category_name", "product_type_key", "product_type_label", "required_attribute_columns", "all_attribute_columns"],
    ...categories.flatMap((category) => getProductTypesForCategory(category).map((type) => [
      category.slug,
      category.name,
      type.key,
      type.label,
      getRequiredFields(type).map(toAttributeColumn).join("|"),
      type.fields.map((field) => toAttributeColumn(field.key)).join("|"),
    ])),
  ];
  return records.map((record) => record.map(escape).join(",")).join("\r\n");
}

async function generatedSku(product: CsvProduct, identicalProductNumber: number): Promise<string> {
  const identity = `${productSkuIdentity(product)}\u001f${identicalProductNumber}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const suffix = Array.from(new Uint8Array(digest).slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `TRB-${suffix.toUpperCase()}`;
}

function toImportPayload(product: CsvProduct, sku: string) {
  const attr = product.attributes;
  return {
    row_number: product.rowNumber,
    sku,
    title: product.title,
    description: product.description,
    price: product.price,
    compare_at_price: product.compareAtPrice,
    currency: product.currency,
    category_id: product.categoryId,
    stock_quantity: product.stockQuantity,
    brand: product.brand,
    gtin: product.gtin,
    mpn: product.mpn,
    condition: product.condition,
    color: attr.color || null,
    material: attr.material || null,
    dimensions: attr.dimensions || null,
    weight: attr.weight || null,
    seo_slug: product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || null,
    meta_description: product.description.slice(0, 160),
    image_urls: product.imageUrls,
    variants: {
      categoryGroup: product.categoryName,
      categoryAttributes: attr,
      productType: {
        key: product.productType.key,
        label: product.productType.label,
        ...(product.productType.subcategory ? { subcategory: product.productType.subcategory } : {}),
      },
      productVideos: [],
    },
  };
}

export default function SellerProductCsvImporter({
  categories,
  categoriesLoading,
  onImported,
}: {
  categories: CsvCategory[];
  categoriesLoading: boolean;
  onImported: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileErrors, setFileErrors] = useState<CsvRowError[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileError, setFileError] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const counts = useMemo(() => rows.reduce((result, row) => {
    result[row.status] += 1;
    return result;
  }, { ready: 0, imported: 0, error: 0 }), [rows]);

  const chooseFile = async (file?: File) => {
    setFileError("");
    setRows([]);
    setFileErrors([]);
    setProgress(0);
    setFileName("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Choose a .csv file exported from Excel or Google Sheets.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("CSV files must be 5 MB or smaller.");
      return;
    }
    try {
      const result = validateSellerProductCsv(await file.text(), categories);
      setFileName(file.name);
      setRows(result.products.map((product) => ({ product, status: "ready" })));
      setFileErrors(result.errors);
      if (result.products.length === 0) setFileError("No rows passed validation. Fix the row errors and upload the CSV again.");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Could not read this CSV file.");
    }
  };

  const importRows = async (retryFailures = false) => {
    if (!user) {
      setFileError("Sign in to your seller account before importing products.");
      return;
    }
    const candidates = rows.filter((row) => retryFailures ? row.status === "error" : row.status === "ready");
    if (candidates.length === 0) return;

    const previouslyImported = rows.filter((row) => row.status === "imported").length;
    setImporting(true);
    setFileError("");
    setProgress(0);
    const working = [...rows];
    const setStateFor = (rowNumber: number, update: Partial<ImportRow>) => {
      const index = working.findIndex((row) => row.product.rowNumber === rowNumber);
      if (index >= 0) working[index] = { ...working[index], ...update };
      setRows([...working]);
    };

    try {
      for (const row of candidates) {
        if (!row.sku) {
          const identity = productSkuIdentity(row.product);
          const identicalProductNumber = rows
            .filter((candidate) => !candidate.product.sku && productSkuIdentity(candidate.product) === identity)
            .findIndex((candidate) => candidate.product.rowNumber === row.product.rowNumber) + 1;
          const sku = await generatedSku(row.product, identicalProductNumber);
          setStateFor(row.product.rowNumber, { sku });
          row.sku = sku;
        }
      }

      let completed = 0;
      for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
        const batch = candidates.slice(offset, offset + BATCH_SIZE);
        const payload = batch.map((row) => toImportPayload(row.product, row.sku!));
        setProgressLabel(`Importing products ${Math.min(offset + batch.length, candidates.length)} of ${candidates.length}`);
        const result = await supabase.rpc("seller_import_product_batch", { p_products: payload as Json });

        if (result.error) {
          if (!["P0001", "23502", "23503", "23505", "23514", "22P02", "22003"].includes(result.error.code)) {
            throw new Error(`The import service could not process this batch: ${result.error.message}`);
          }
          for (const row of batch) {
            const retry = await supabase.rpc("seller_import_product_batch", {
              p_products: [toImportPayload(row.product, row.sku!)] as Json,
            });
            if (retry.error) {
              setStateFor(row.product.rowNumber, { status: "error", error: retry.error.message });
            } else if (retry.data?.some((saved) => saved.row_number === row.product.rowNumber)) {
              setStateFor(row.product.rowNumber, { status: "imported", error: undefined });
            } else {
              setStateFor(row.product.rowNumber, { status: "error", error: "The server did not confirm this product. Retry this row." });
            }
            completed += 1;
            setProgress(Math.round((completed / candidates.length) * 100));
          }
        } else {
          const savedRows = new Set((result.data ?? []).map((saved) => saved.row_number));
          for (const row of batch) {
            if (savedRows.has(row.product.rowNumber)) {
              setStateFor(row.product.rowNumber, { status: "imported", error: undefined });
            } else {
              setStateFor(row.product.rowNumber, { status: "error", error: "The server did not confirm this product. Retry this row." });
            }
          }
          completed += batch.length;
          setProgress(Math.round((completed / candidates.length) * 100));
        }
      }

      const importedCount = working.filter((row) => row.status === "imported").length - previouslyImported;
      if (importedCount > 0) {
        onImported();
        toast({ title: `${importedCount} product${importedCount === 1 ? "" : "s"} submitted`, description: "They are now in the usual admin approval process." });
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "The import stopped because of an unexpected error.");
    } finally {
      setImporting(false);
      setProgressLabel("");
    }
  };

  const previewRows = rows.slice(0, 10);
  const failedRows = counts.error;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Upload className="h-4 w-4" /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import products from a spreadsheet</DialogTitle>
          <DialogDescription>
            Add up to 1,000 listings in one CSV. We validate the entire file before creating products; new listings still go through the normal approval process.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-semibold">Start with the template</p>
              <p className="mt-1 text-xs text-muted-foreground">Images must be public HTTPS URLs. Separate multiple image URLs with a vertical bar: URL1|URL2.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={categoriesLoading || categories.length === 0} onClick={() => downloadFile("tradibu-category-attribute-reference.csv", categoryReferenceCsv(categories))}>
                <Download className="mr-2 h-4 w-4" /> Category reference
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => downloadFile("tradibu-product-import-template.csv", SELLER_PRODUCT_CSV_TEMPLATE)}>
                <Download className="mr-2 h-4 w-4" /> CSV template
              </Button>
            </div>
          </div>

          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">CSV instructions and category values</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{SELLER_PRODUCT_CSV_GUIDE}</pre>
            <p className="mt-2 text-xs font-medium">Categories: {categories.map((category) => `${category.name} (${category.slug})`).join(", ") || "Loading…"}</p>
            <p className="mt-1 text-xs text-muted-foreground">For each category, product type keys and labels must match the seller listing form. Add required fields as attr_fieldname columns.</p>
          </details>

          <div>
            <label htmlFor="seller-product-csv" className="mb-1 block text-sm font-medium">Choose a CSV file</label>
            <input
              id="seller-product-csv"
              type="file"
              accept=".csv,text/csv"
              disabled={importing || categoriesLoading || categories.length === 0}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                void chooseFile(file);
              }}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {categoriesLoading ? "Loading product categories…" : categories.length === 0 ? "No product categories are available. Refresh or contact support before importing." : "CSV only, up to 5 MB. The importer accepts a maximum of 1,000 product rows."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Each row imports one single-price listing. SKU variant matrices are not imported; use the product form for listings with selectable variants.</p>
          </div>

          {fileName && <p className="text-sm font-medium">{fileName}: {rows.length} valid row{rows.length === 1 ? "" : "s"}, {fileErrors.length} row{fileErrors.length === 1 ? "" : "s"} need correction.</p>}
          {fileError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{fileError}</p>}

          {fileErrors.length > 0 && (
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><CircleAlert className="h-4 w-4" /> Fix these rows in the spreadsheet, then upload it again</p>
              {fileErrors.slice(0, 30).map((item) => (
                <p key={`${item.rowNumber}-${item.title}`} className="text-xs">
                  <strong>Row {item.rowNumber} ({item.title}):</strong> {item.errors.join(" ")}
                </p>
              ))}
              {fileErrors.length > 30 && <p className="text-xs">Showing the first 30 row errors.</p>}
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr><th className="p-2">Row</th><th className="p-2">Product</th><th className="p-2">Category / type</th><th className="p-2">Price</th><th className="p-2">Images</th><th className="p-2">Result</th></tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.product.rowNumber} className="border-t border-border">
                        <td className="p-2">{row.product.rowNumber}</td>
                        <td className="max-w-48 truncate p-2">{row.product.title}</td>
                        <td className="p-2">{row.product.categoryName} / {row.product.productType.label}</td>
                        <td className="p-2">{row.product.currency} {row.product.price.toLocaleString()}</td>
                        <td className="p-2">{row.product.imageUrls.length}</td>
                        <td className="p-2">
                          {row.status === "imported" ? "Submitted" : row.status === "error" ? row.error : "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > previewRows.length && <p className="p-2 text-xs text-muted-foreground">Showing the first {previewRows.length} of {rows.length} valid products.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{counts.ready} ready</span><span>{counts.imported} submitted</span><span>{counts.error} failed</span>
              </div>
            </>
          )}

          {importing && (
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{progressLabel}</div>
              <Progress value={progress} />
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {failedRows > 0 && (
              <Button type="button" variant="outline" onClick={() => void importRows(true)} disabled={importing}>
                Retry {failedRows} failed row{failedRows === 1 ? "" : "s"}
              </Button>
            )}
            <Button type="button" onClick={() => void importRows()} disabled={importing || counts.ready === 0}>
              {importing ? "Importing…" : <><CheckCircle2 className="mr-2 h-4 w-4" /> Import {counts.ready} valid product{counts.ready === 1 ? "" : "s"}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
