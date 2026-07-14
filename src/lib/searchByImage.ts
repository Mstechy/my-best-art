type VisualSearchResult = {
  search: string;
  category: string | null;
  visual: "1";
};

const TOKEN_MAP: Record<string, { search?: string; category?: string }> = {
  apparel: { search: "fashion", category: "fashion" },
  clothing: { search: "fashion", category: "fashion" },
  jogger: { search: "jogger", category: "fashion" },
  joggers: { search: "jogger", category: "fashion" },
  sneaker: { search: "sneaker", category: "fashion" },
  sneakers: { search: "sneaker", category: "fashion" },
  hoodie: { search: "hoodie", category: "fashion" },
  hoodies: { search: "hoodie", category: "fashion" },
  shirt: { search: "shirt", category: "fashion" },
  tshirt: { search: "shirt", category: "fashion" },
  tee: { search: "shirt", category: "fashion" },
  dress: { search: "dress", category: "fashion" },
  skirt: { search: "skirt", category: "fashion" },
  jacket: { search: "jacket", category: "fashion" },
  handbag: { search: "handbag", category: "fashion" },
  bag: { search: "bag", category: "fashion" },
  wallet: { search: "wallet", category: "fashion" },
  purse: { search: "bag", category: "fashion" },
  watch: { search: "watch", category: "electronics" },
  smartwatch: { search: "watch", category: "electronics" },
  phone: { search: "phone", category: "electronics" },
  tablet: { search: "tablet", category: "electronics" },
  headphones: { search: "headphones", category: "electronics" },
  speaker: { search: "speaker", category: "electronics" },
  laptop: { search: "laptop", category: "electronics" },
  camera: { search: "camera", category: "electronics" },
  charger: { search: "charger", category: "electronics" },
  cable: { search: "cable", category: "electronics" },
  tv: { search: "television", category: "electronics" },
  lamp: { search: "lamp", category: "home" },
  chair: { search: "chair", category: "home" },
  sofa: { search: "sofa", category: "home" },
  table: { search: "table", category: "home" },
  decor: { search: "decor", category: "home" },
  kitchen: { search: "kitchen", category: "home" },
  ring: { search: "ring", category: "jewelry" },
  necklace: { search: "necklace", category: "jewelry" },
  bracelet: { search: "bracelet", category: "jewelry" },
  shoes: { search: "shoes", category: "fashion" },
  makeup: { search: "makeup", category: "beauty" },
  beauty: { search: "beauty", category: "beauty" },
  perfume: { search: "perfume", category: "beauty" },
  toy: { search: "toy", category: "toys" },
  game: { search: "game", category: "toys" },
};

const STOP_WORDS = new Set(["image", "img", "photo", "picture", "scan", "download", "upload", "file"]);

export function buildVisualSearchResult(filename: string, categoryHint: string | null = null): VisualSearchResult {
  const stem = filename.replace(/\.[^.]+$/, "");
  const tokens = stem
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(token => token.trim())
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));

  const mapped = tokens.flatMap(token => {
    const entry = TOKEN_MAP[token];
    if (!entry) return [];
    return [entry];
  });

  const search = mapped.map(entry => entry.search).filter(Boolean).join(" ").trim();
  const category = mapped.map(entry => entry.category).find(Boolean) || categoryHint || null;

  return {
    search: search || tokens.slice(0, 3).join(" ") || "",
    category,
    visual: "1",
  };
}
