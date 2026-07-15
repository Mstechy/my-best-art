export function generateSku(prefix = "MHB") {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(-5).padStart(5, "0");
  return `${prefix}-${date}-${random}`;
}
