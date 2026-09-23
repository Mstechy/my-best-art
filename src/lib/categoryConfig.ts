export type CategoryAttribute = {
  key: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  type?: "text" | "select" | "textarea" | "date";
  options?: string[];
  required?: boolean;
};

export type ProductTypeConfig = {
  key: string;
  label: string;
  subcategory?: string;
  fields: CategoryAttribute[];
  filters?: string[];
  requiredFields?: string[];
};

export type CategoryConfig = {
  title: string;
  aliases: string[];
  fields: CategoryAttribute[];
  filters: string[];
  productTypes: ProductTypeConfig[];
  supportsWarranty?: boolean;
};

const conditionField: CategoryAttribute = { key: "condition", label: "Condition", type: "select", options: ["New", "Used", "Refurbished"], required: true };
const genderField: CategoryAttribute = { key: "gender", label: "Gender", type: "select", options: ["Women", "Men", "Unisex", "Kids"], required: true };
const colorField: CategoryAttribute = { key: "color", label: "Color", placeholder: "Black, white, blue", required: true };
const brandField: CategoryAttribute = { key: "brand", label: "Brand", placeholder: "Brand or maker", required: true };

const apparelFields = (extra: CategoryAttribute[] = []): CategoryAttribute[] => [
  brandField,
  genderField,
  { key: "size", label: "Size", placeholder: "S, M, L, XL", required: true },
  colorField,
  { key: "material", label: "Fabric / Material", placeholder: "Cotton, linen, polyester", required: true },
  { key: "fit", label: "Fit", placeholder: "Slim, regular, oversized" },
  { key: "sleeveType", label: "Sleeve Type", placeholder: "Short sleeve, long sleeve" },
  { key: "pattern", label: "Pattern", placeholder: "Plain, graphic, striped" },
  { key: "season", label: "Season", placeholder: "Summer, winter, all season" },
  { key: "careInstructions", label: "Care Instructions", placeholder: "Machine wash cold" },
  ...extra,
];

const shoeFields = (label = "Shoe Size"): CategoryAttribute[] => [
  brandField,
  genderField,
  { key: "shoeSize", label, placeholder: "US 10, EU 43, UK 9", required: true },
  colorField,
  { key: "material", label: "Material", placeholder: "Leather, canvas, mesh", required: true },
  { key: "soleMaterial", label: "Sole Material", placeholder: "Rubber, EVA, leather" },
  { key: "closureType", label: "Closure Type", placeholder: "Lace-up, slip-on, buckle" },
  { key: "occasion", label: "Occasion", placeholder: "Casual, formal, sports" },
];

const homeFields = (extra: CategoryAttribute[] = []): CategoryAttribute[] => [
  { key: "material", label: "Material", placeholder: "Wood, ceramic, cotton", required: true },
  { key: "dimensions", label: "Dimensions", placeholder: "40 x 60 x 10 cm", required: true },
  colorField,
  { key: "weight", label: "Weight", placeholder: "2kg" },
  { key: "style", label: "Style", placeholder: "Modern, vintage, minimalist" },
  { key: "roomType", label: "Room", placeholder: "Living room, bedroom, kitchen" },
  ...extra,
];

const simpleType = (
  key: string,
  label: string,
  subcategory: string,
  fields: CategoryAttribute[],
  filters?: string[],
  requiredFields?: string[]
): ProductTypeConfig => ({
  key,
  label,
  subcategory,
  fields,
  filters,
  requiredFields,
});

// Phones are high-consideration products. These attributes make a 256GB iPhone
// listing comparable and trustworthy without collecting sensitive serial/IMEI
// values that should never be displayed publicly.
const phoneFields = (): CategoryAttribute[] => [
  { key: "brand", label: "Brand", placeholder: "Apple, Samsung, Xiaomi", required: true },
  { key: "model", label: "Model", placeholder: "iPhone 15 Pro, Galaxy S24", required: true },
  { key: "storage", label: "Storage", placeholder: "256GB, or Varies by variant", required: true },
  { key: "color", label: "Colour", placeholder: "Natural Titanium, or Varies by variant", required: true },
  { key: "ram", label: "RAM", placeholder: "8GB" },
  { key: "processor", label: "Processor", placeholder: "A17 Pro, Snapdragon 8 Gen 3" },
  { key: "screenSize", label: "Screen size", placeholder: "6.1 inches" },
  { key: "battery", label: "Battery capacity", placeholder: "3274mAh" },
  { key: "batteryHealth", label: "Battery health", type: "select", options: ["New / not applicable", "100%", "90–99%", "80–89%", "Below 80%"], required: true },
  { key: "operatingSystem", label: "Operating system", placeholder: "iOS 18, Android 15", required: true },
  { key: "connectivity", label: "Connectivity", type: "select", options: ["Wi-Fi only (no mobile network)", "Wi-Fi + cellular mobile data", "Cellular mobile data + Wi-Fi", "Unknown"], required: true, helpText: "Choose Wi-Fi only for devices that cannot use a SIM or eSIM." },
  { key: "network", label: "Mobile network support", type: "select", options: ["No mobile network (Wi-Fi-only)", "2G / 3G", "4G LTE", "5G", "4G LTE + 5G", "Unknown"], required: true, helpText: "For Wi-Fi-only devices, choose No mobile network." },
  { key: "simType", label: "SIM / cellular support", type: "select", options: ["No SIM or eSIM support (Wi-Fi-only)", "Single physical SIM", "Dual physical SIM", "eSIM only", "Physical SIM + eSIM", "Dual physical SIM + eSIM", "Unknown"], required: true, helpText: "This tells buyers whether they can insert a SIM or activate an eSIM." },
  { key: "carrierStatus", label: "Carrier / network lock (optional)", type: "select", options: ["Factory unlocked", "Locked to a carrier", "Unknown - not tested", "Not applicable - Wi-Fi-only"], helpText: "Only complete this when the device has cellular capability. Do not guess." },
  { key: "activationLockStatus", label: "Account / activation lock (optional)", type: "select", options: ["No account lock - ready for new owner", "Account lock enabled", "Unknown - not checked", "Not applicable - device has no account lock feature", "Not applicable - new sealed device"], helpText: "Use this for iCloud, Google/FRP, or similar account locks when applicable. Never publish an IMEI or serial number." },
  { key: "cosmeticCondition", label: "Cosmetic condition", type: "select", options: ["New / sealed", "Excellent", "Good", "Fair"], required: true },
  conditionField,
  { key: "accessoriesIncluded", label: "Included in the box", placeholder: "Phone, USB-C cable, original box" },
  { key: "warranty", label: "Warranty", placeholder: "Manufacturer or seller warranty" },
];

export const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  electronics: {
    title: "Electronics Specifications",
    aliases: ["electronics", "computers", "gaming", "home-appliances", "phones-accessories", "phones-and-accessories"],
    filters: ["brand", "condition", "storage", "ram", "warranty"],
    fields: [
      { key: "brand", label: "Brand", placeholder: "Apple, Samsung, Sony" },
      { key: "model", label: "Model", placeholder: "iPhone 15, PlayStation 5" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Used", "Refurbished"] },
      { key: "storage", label: "Storage", placeholder: "128GB, 1TB" },
      { key: "ram", label: "RAM", placeholder: "8GB, 16GB" },
      { key: "color", label: "Color", placeholder: "Black, Silver" },
      { key: "warranty", label: "Warranty", placeholder: "1 Year, Seller warranty" },
      { key: "voltage", label: "Voltage", placeholder: "110V, 220V, Dual voltage" },
      { key: "accessoriesIncluded", label: "Accessories Included", placeholder: "Charger, cable, case" },
    ],
    productTypes: [
      {
        key: "mobile-phones",
        label: "Mobile Phones",
        filters: ["brand", "storage", "ram", "operatingSystem", "condition"],
        fields: phoneFields(),
        requiredFields: ["brand", "model", "storage", "color", "batteryHealth", "operatingSystem", "connectivity", "network", "simType", "cosmeticCondition", "condition"],
      },
      {
        key: "laptops",
        label: "Laptops & Computers",
        filters: ["brand", "processor", "ram", "storage", "condition"],
        fields: [
          { key: "brand", label: "Brand", placeholder: "Apple, HP, Dell" },
          { key: "model", label: "Model", placeholder: "MacBook Air M3, XPS 13" },
          { key: "processor", label: "Processor", placeholder: "Intel i7, Apple M3" },
          { key: "ram", label: "RAM", placeholder: "8GB, 16GB" },
          { key: "storage", label: "Storage", placeholder: "512GB SSD" },
          { key: "screenSize", label: "Screen Size", placeholder: "13.6 inches" },
          { key: "graphics", label: "Graphics", placeholder: "Integrated, RTX 4060" },
          { key: "condition", label: "Condition", type: "select", options: ["New", "Used", "Refurbished"] },
          { key: "warranty", label: "Warranty", placeholder: "Manufacturer or seller warranty" },
        ],
      },
      {
        key: "audio",
        label: "Audio & Accessories",
        fields: [
          { key: "brand", label: "Brand", placeholder: "Sony, JBL, Bose" },
          { key: "model", label: "Model", placeholder: "WH-1000XM5" },
          { key: "connectivity", label: "Connectivity", placeholder: "Bluetooth, USB-C, 3.5mm" },
          { key: "battery", label: "Battery Life", placeholder: "30 hours" },
          { key: "color", label: "Color", placeholder: "Black, Silver" },
          { key: "condition", label: "Condition", type: "select", options: ["New", "Used", "Refurbished"] },
          { key: "warranty", label: "Warranty", placeholder: "6 Months, 1 Year" },
        ],
      },
    ],
  },
  fashion: {
    title: "Fashion Details",
    aliases: ["fashion", "clothing", "bags", "glasses"],
    filters: ["brand", "gender", "size", "color", "material"],
    supportsWarranty: false,
    fields: [
      { key: "brand", label: "Brand", placeholder: "Nike, Zara, Unbranded" },
      { key: "gender", label: "Gender", type: "select", options: ["Women", "Men", "Unisex", "Kids"] },
      { key: "size", label: "Size", placeholder: "S, M, L, XL, 42" },
      { key: "material", label: "Material", placeholder: "Cotton, leather, silk" },
      { key: "color", label: "Color", placeholder: "Blue, Black" },
      { key: "fit", label: "Fit", placeholder: "Slim, Regular, Oversized" },
      { key: "sleeveType", label: "Sleeve Type", placeholder: "Short sleeve, Long sleeve" },
      { key: "season", label: "Season", placeholder: "Summer, Winter, All season" },
    ],
    productTypes: [
      {
        key: "t-shirts",
        label: "T-Shirts",
        filters: ["brand", "gender", "size", "color", "material"],
        fields: [
          { key: "brand", label: "Brand", placeholder: "Nike, Zara, Unbranded" },
          { key: "gender", label: "Gender", type: "select", options: ["Women", "Men", "Unisex", "Kids"] },
          { key: "size", label: "Size", placeholder: "S, M, L, XL" },
          { key: "color", label: "Color", placeholder: "Black, White" },
          { key: "material", label: "Material", placeholder: "Cotton, polyester blend" },
          { key: "fit", label: "Fit", placeholder: "Slim, Regular, Oversized" },
          { key: "sleeveLength", label: "Sleeve Length", placeholder: "Short sleeve, Long sleeve" },
          { key: "neckStyle", label: "Neck Style", placeholder: "Crew neck, V-neck" },
          { key: "pattern", label: "Pattern", placeholder: "Plain, striped, graphic" },
          { key: "season", label: "Season", placeholder: "Summer, All season" },
          { key: "careInstructions", label: "Care Instructions", placeholder: "Machine wash cold" },
        ],
      },
      {
        key: "bags",
        label: "Bags",
        fields: [
          { key: "brand", label: "Brand", placeholder: "Coach, Zara, Unbranded" },
          { key: "bagType", label: "Bag Type", placeholder: "Handbag, backpack, tote" },
          { key: "material", label: "Material", placeholder: "Leather, canvas, nylon" },
          { key: "color", label: "Color", placeholder: "Black, tan" },
          { key: "dimensions", label: "Dimensions", placeholder: "30 x 20 x 10 cm" },
          { key: "closureType", label: "Closure Type", placeholder: "Zip, magnetic, buckle" },
          { key: "strapType", label: "Strap Type", placeholder: "Adjustable, chain, crossbody" },
        ],
      },
      {
        key: "glasses",
        label: "Glasses",
        fields: [
          { key: "brand", label: "Brand", placeholder: "Ray-Ban, Oakley" },
          { key: "frameMaterial", label: "Frame Material", placeholder: "Acetate, metal" },
          { key: "lensType", label: "Lens Type", placeholder: "Prescription, polarized" },
          { key: "frameColor", label: "Frame Color", placeholder: "Black, gold" },
          { key: "lensColor", label: "Lens Color", placeholder: "Clear, brown" },
          { key: "frameShape", label: "Frame Shape", placeholder: "Round, square, aviator" },
        ],
      },
    ],
  },
  shoes: {
    title: "Shoe Details",
    aliases: ["shoes"],
    filters: ["brand", "gender", "size", "color", "material"],
    supportsWarranty: false,
    fields: [
      { key: "brand", label: "Brand", placeholder: "Adidas, Clarks" },
      { key: "size", label: "Size", placeholder: "US 10, EU 43, UK 9" },
      { key: "gender", label: "Gender", type: "select", options: ["Women", "Men", "Unisex", "Kids"] },
      { key: "color", label: "Color", placeholder: "White, Brown" },
      { key: "material", label: "Material", placeholder: "Leather, canvas, mesh" },
      { key: "soleType", label: "Sole Type", placeholder: "Rubber, leather, EVA" },
    ],
    productTypes: [
      {
        key: "shoes",
        label: "Shoes",
        filters: ["brand", "gender", "shoeSize", "color", "material"],
        fields: [
          { key: "brand", label: "Brand", placeholder: "Adidas, Clarks" },
          { key: "gender", label: "Gender", type: "select", options: ["Women", "Men", "Unisex", "Kids"] },
          { key: "shoeSize", label: "Shoe Size", placeholder: "US 10, EU 43, UK 9" },
          { key: "color", label: "Color", placeholder: "White, Brown" },
          { key: "material", label: "Material", placeholder: "Leather, canvas, mesh" },
          { key: "soleMaterial", label: "Sole Material", placeholder: "Rubber, EVA, leather" },
          { key: "closureType", label: "Closure Type", placeholder: "Lace-up, slip-on, buckle" },
          { key: "heelHeight", label: "Heel Height", placeholder: "Flat, 2 inches" },
          { key: "occasion", label: "Occasion", placeholder: "Casual, formal, sports" },
        ],
      },
    ],
  },
  home: {
    title: "Home & Decor Specifications",
    aliases: ["home-decor", "home-and-decor", "home-garden", "home-and-garden", "kitchen", "pet-supplies", "baby-products"],
    filters: ["material", "color", "style", "roomType"],
    fields: [
      { key: "material", label: "Material", placeholder: "Wood, ceramic, cotton" },
      { key: "dimensions", label: "Dimensions", placeholder: "40 x 60 x 10 cm" },
      { key: "color", label: "Color", placeholder: "Natural, white" },
      { key: "weight", label: "Weight", placeholder: "2kg" },
      { key: "style", label: "Style", placeholder: "Modern, vintage, minimalist" },
      { key: "roomType", label: "Room Type", placeholder: "Living room, bedroom, kitchen" },
    ],
    productTypes: [
      {
        key: "rugs",
        label: "Rugs",
        fields: [
          { key: "material", label: "Material", placeholder: "Wool, cotton, jute" },
          { key: "dimensions", label: "Dimensions", placeholder: "160 x 230 cm" },
          { key: "weight", label: "Weight", placeholder: "4kg" },
          { key: "style", label: "Style", placeholder: "Modern, Persian, boho" },
          { key: "color", label: "Color", placeholder: "Neutral, blue" },
          { key: "roomType", label: "Room", placeholder: "Living room, bedroom" },
        ],
      },
      {
        key: "curtains",
        label: "Curtains",
        fields: [
          { key: "material", label: "Material", placeholder: "Linen, velvet, cotton" },
          { key: "dimensions", label: "Dimensions", placeholder: "140 x 240 cm" },
          { key: "color", label: "Color", placeholder: "White, beige" },
          { key: "style", label: "Style", placeholder: "Blackout, sheer" },
          { key: "roomType", label: "Room", placeholder: "Bedroom, living room" },
          { key: "installationType", label: "Installation Type", placeholder: "Rod pocket, eyelet" },
        ],
      },
      {
        key: "lamps",
        label: "Lamps",
        fields: [
          { key: "material", label: "Material", placeholder: "Metal, ceramic, wood" },
          { key: "dimensions", label: "Dimensions", placeholder: "45 x 20 cm" },
          { key: "style", label: "Style", placeholder: "Modern, industrial" },
          { key: "color", label: "Color", placeholder: "Black, brass" },
          { key: "roomType", label: "Room", placeholder: "Bedroom, office" },
          { key: "voltage", label: "Voltage", placeholder: "110V, 220V" },
          { key: "bulbType", label: "Bulb Type", placeholder: "LED, E27" },
        ],
      },
      {
        key: "wall-art",
        label: "Wall Art",
        fields: [
          { key: "material", label: "Material", placeholder: "Canvas, paper, wood" },
          { key: "dimensions", label: "Dimensions", placeholder: "50 x 70 cm" },
          { key: "style", label: "Style", placeholder: "Abstract, landscape" },
          { key: "color", label: "Color", placeholder: "Multicolor, neutral" },
          { key: "roomType", label: "Room", placeholder: "Living room, hallway" },
          { key: "frameIncluded", label: "Frame Included", type: "select", options: ["Yes", "No"] },
        ],
      },
      {
        key: "decorative-items",
        label: "Decorative Items",
        fields: [
          { key: "material", label: "Material", placeholder: "Ceramic, glass, wood" },
          { key: "dimensions", label: "Dimensions", placeholder: "20 x 12 cm" },
          { key: "weight", label: "Weight", placeholder: "1kg" },
          { key: "style", label: "Style", placeholder: "Minimalist, vintage" },
          { key: "color", label: "Color", placeholder: "Gold, white" },
          { key: "roomType", label: "Room", placeholder: "Living room, bedroom" },
        ],
      },
      {
        key: "storage",
        label: "Storage",
        fields: [
          { key: "material", label: "Material", placeholder: "Plastic, wood, fabric" },
          { key: "dimensions", label: "Dimensions", placeholder: "60 x 40 x 30 cm" },
          { key: "weight", label: "Weight", placeholder: "3kg" },
          { key: "color", label: "Color", placeholder: "White, natural" },
          { key: "roomType", label: "Room", placeholder: "Closet, kitchen" },
          { key: "assemblyRequired", label: "Assembly Required", type: "select", options: ["Yes", "No", "Partial"] },
        ],
      },
    ],
  },
  furniture: {
    title: "Furniture Specifications",
    aliases: ["furniture"],
    filters: ["material", "color", "style", "assemblyRequired"],
    fields: [
      { key: "material", label: "Material", placeholder: "Oak, metal, fabric" },
      { key: "dimensions", label: "Dimensions", placeholder: "120 x 80 x 75 cm" },
      { key: "assemblyRequired", label: "Assembly Required", type: "select", options: ["Yes", "No", "Partial"] },
      { key: "weight", label: "Weight", placeholder: "18kg" },
      { key: "color", label: "Color", placeholder: "Walnut, grey" },
      { key: "style", label: "Style", placeholder: "Scandinavian, industrial" },
    ],
    productTypes: [
      {
        key: "furniture",
        label: "Furniture",
        fields: [
          { key: "material", label: "Material", placeholder: "Oak, metal, fabric" },
          { key: "dimensions", label: "Dimensions", placeholder: "120 x 80 x 75 cm" },
          { key: "assemblyRequired", label: "Assembly Required", type: "select", options: ["Yes", "No", "Partial"] },
          { key: "weight", label: "Weight", placeholder: "18kg" },
          { key: "color", label: "Color", placeholder: "Walnut, grey" },
          { key: "style", label: "Style", placeholder: "Scandinavian, industrial" },
          { key: "roomType", label: "Room", placeholder: "Living room, office" },
        ],
      },
    ],
  },
  watches: {
    title: "Watch Details",
    aliases: ["watches"],
    filters: ["brand", "gender", "material", "color"],
    supportsWarranty: false,
    fields: [],
    productTypes: [
      {
        key: "watches",
        label: "Watches",
        fields: [
          { key: "brand", label: "Brand", placeholder: "Casio, Seiko, Rolex" },
          { key: "gender", label: "Gender", type: "select", options: ["Women", "Men", "Unisex"] },
          { key: "caseMaterial", label: "Case Material", placeholder: "Stainless steel, resin" },
          { key: "strapMaterial", label: "Strap Material", placeholder: "Leather, silicone" },
          { key: "movement", label: "Movement", placeholder: "Quartz, automatic" },
          { key: "waterResistance", label: "Water Resistance", placeholder: "30m, 100m" },
          { key: "color", label: "Color", placeholder: "Silver, black" },
          { key: "condition", label: "Condition", type: "select", options: ["New", "Used", "Refurbished"] },
        ],
      },
    ],
  },
  jewelry: {
    title: "Jewelry Details",
    aliases: ["jewelry"],
    filters: ["material", "metalType", "stoneType", "color"],
    supportsWarranty: false,
    fields: [],
    productTypes: [
      {
        key: "rings",
        label: "Rings",
        fields: [
          { key: "material", label: "Material", placeholder: "Gold, silver, stainless steel" },
          { key: "metalType", label: "Metal Type", placeholder: "18k gold, sterling silver" },
          { key: "stoneType", label: "Stone Type", placeholder: "Diamond, zircon, none" },
          { key: "ringSize", label: "Ring Size", placeholder: "US 7, adjustable" },
          { key: "color", label: "Color", placeholder: "Gold, silver" },
          { key: "finish", label: "Finish", placeholder: "Polished, matte" },
        ],
      },
      {
        key: "necklaces",
        label: "Necklaces",
        fields: [
          { key: "material", label: "Material", placeholder: "Gold, silver, beads" },
          { key: "metalType", label: "Metal Type", placeholder: "14k gold, stainless steel" },
          { key: "stoneType", label: "Stone Type", placeholder: "Pearl, crystal, none" },
          { key: "necklaceLength", label: "Necklace Length", placeholder: "45 cm, 18 inches" },
          { key: "color", label: "Color", placeholder: "Gold, rose gold" },
          { key: "finish", label: "Finish", placeholder: "Polished, brushed" },
        ],
      },
      {
        key: "bracelets-earrings",
        label: "Bracelets & Earrings",
        fields: [
          { key: "material", label: "Material", placeholder: "Gold, silver, acrylic" },
          { key: "metalType", label: "Metal Type", placeholder: "Sterling silver" },
          { key: "stoneType", label: "Stone Type", placeholder: "Crystal, none" },
          { key: "color", label: "Color", placeholder: "Silver, black" },
          { key: "finish", label: "Finish", placeholder: "Polished, matte" },
          { key: "closureType", label: "Closure Type", placeholder: "Hook, clasp" },
        ],
      },
    ],
  },
  beauty: {
    title: "Health & Beauty Details",
    aliases: ["beauty", "health-beauty", "health-and-beauty"],
    filters: ["brand", "skinType", "fragranceFamily", "volume"],
    supportsWarranty: false,
    fields: [],
    productTypes: [
      {
        key: "perfume",
        label: "Perfume",
        filters: ["brand", "fragranceFamily", "volume", "gender"],
        fields: [
          { key: "brand", label: "Brand", placeholder: "Dior, Chanel" },
          { key: "fragranceFamily", label: "Fragrance Family", placeholder: "Floral, woody, citrus" },
          { key: "volume", label: "Volume (ml)", placeholder: "50ml, 100ml" },
          { key: "gender", label: "Gender", type: "select", options: ["Women", "Men", "Unisex"] },
          { key: "concentration", label: "Concentration", placeholder: "EDT, EDP, Parfum" },
          { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "Key ingredients or full ingredient list" },
          { key: "expiryDate", label: "Expiry Date", type: "date" },
        ],
      },
      {
        key: "body-scrub",
        label: "Body Scrub",
        fields: [
          { key: "brand", label: "Brand", placeholder: "Tree Hut, Dove" },
          { key: "skinType", label: "Skin Type", placeholder: "Dry, oily, sensitive" },
          { key: "volume", label: "Volume", placeholder: "250ml, 500g" },
          { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "Sugar, shea butter, oils" },
          { key: "benefits", label: "Benefits", placeholder: "Exfoliating, smoothing" },
          { key: "usageInstructions", label: "Usage Instructions", type: "textarea", placeholder: "How buyers should use it" },
          { key: "expiryDate", label: "Expiry Date", type: "date" },
        ],
      },
      {
        key: "nail-products",
        label: "Nail Products",
        fields: [
          { key: "brand", label: "Brand", placeholder: "OPI, Essie" },
          { key: "shade", label: "Shade", placeholder: "Ruby red, nude" },
          { key: "finish", label: "Finish", placeholder: "Glossy, matte, glitter" },
          { key: "volume", label: "Volume", placeholder: "15ml" },
          { key: "type", label: "Type", placeholder: "Gel polish, acrylic powder" },
          { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "Ingredient list" },
        ],
      },
    ],
  },
  general: {
    title: "Product Specifications",
    aliases: ["books", "toys", "auto-parts", "vehicles", "sports", "food-drink"],
    filters: ["brand", "condition", "material", "color"],
    fields: [
      { key: "brand", label: "Brand", placeholder: "Brand or publisher" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Used", "Refurbished"] },
      { key: "material", label: "Material", placeholder: "Main material" },
      { key: "color", label: "Color", placeholder: "Primary color" },
      { key: "dimensions", label: "Dimensions", placeholder: "Package or item size" },
      { key: "weight", label: "Weight", placeholder: "Item weight" },
    ],
    productTypes: [
      {
        key: "general",
        label: "General Product",
        fields: [
          { key: "brand", label: "Brand", placeholder: "Brand, maker, or publisher" },
          { key: "condition", label: "Condition", type: "select", options: ["New", "Used", "Refurbished"] },
          { key: "material", label: "Material", placeholder: "Main material" },
          { key: "color", label: "Color", placeholder: "Primary color" },
          { key: "dimensions", label: "Dimensions", placeholder: "Package or item size" },
          { key: "weight", label: "Weight", placeholder: "Item weight" },
        ],
      },
    ],
  },
};

CATEGORY_CONFIGS.electronics.productTypes.push(
  simpleType("phones", "Phones", "Phones & Accessories", [
    ...phoneFields(),
  ], ["brand", "storage", "network", "condition"], ["brand", "model", "storage", "color", "batteryHealth", "operatingSystem", "connectivity", "network", "simType", "cosmeticCondition", "condition"]),
  simpleType("tablets", "Tablets", "Phones & Accessories", [
    brandField,
    { key: "model", label: "Model", placeholder: "iPad Air, Galaxy Tab", required: true },
    { key: "storage", label: "Storage", placeholder: "64GB, 256GB", required: true },
    { key: "screenSize", label: "Screen Size", placeholder: "10.9 inches" },
    { key: "connectivity", label: "Connectivity", type: "select", options: ["Wi-Fi only (no SIM)", "Wi-Fi + cellular", "Cellular + Wi-Fi", "Unknown"], required: true, helpText: "Select Wi-Fi only for a tablet without a SIM or eSIM." },
    { key: "simType", label: "SIM / cellular support (optional)", type: "select", options: ["No SIM or eSIM support (Wi-Fi-only)", "Single physical SIM", "eSIM only", "Physical SIM + eSIM", "Unknown"], helpText: "Only needed to clarify a cellular-capable tablet." },
    { key: "carrierStatus", label: "Carrier / network lock (optional)", type: "select", options: ["Factory unlocked", "Locked to a carrier", "Unknown - not tested", "Not applicable - Wi-Fi-only"] },
    { key: "activationLockStatus", label: "Account / activation lock (optional)", type: "select", options: ["No account lock - ready for new owner", "Account lock enabled", "Unknown - not checked", "Not applicable - device has no account lock feature", "Not applicable - new sealed device"] },
    conditionField,
    { key: "warranty", label: "Warranty", placeholder: "Manufacturer or seller warranty" },
  ], ["brand", "storage", "connectivity", "condition"], ["brand", "model", "storage", "connectivity", "condition"]),
  simpleType("tvs", "TVs", "Home Electronics", [
    brandField,
    { key: "screenSize", label: "Screen Size", placeholder: "55 inches", required: true },
    { key: "displayType", label: "Display Type", placeholder: "LED, OLED, QLED" },
    { key: "resolution", label: "Resolution", placeholder: "4K, 8K, Full HD", required: true },
    { key: "smartTv", label: "Smart TV", type: "select", options: ["Yes", "No"] },
    { key: "ports", label: "Ports", placeholder: "HDMI, USB, Ethernet" },
    conditionField,
    { key: "warranty", label: "Warranty", placeholder: "Manufacturer or seller warranty" },
  ], ["brand", "screenSize", "resolution", "condition"], ["brand", "screenSize", "resolution", "condition"]),
  simpleType("cameras", "Cameras", "Cameras", [
    brandField,
    { key: "model", label: "Model", placeholder: "Canon EOS R50", required: true },
    { key: "cameraType", label: "Camera Type", placeholder: "DSLR, mirrorless, action" },
    { key: "megapixels", label: "Megapixels", placeholder: "24MP" },
    { key: "lensIncluded", label: "Lens Included", placeholder: "18-55mm kit lens" },
    conditionField,
    { key: "warranty", label: "Warranty", placeholder: "Manufacturer or seller warranty" },
  ], ["brand", "cameraType", "condition"], ["brand", "model", "condition"]),
  simpleType("gaming-consoles", "Gaming Consoles", "Gaming", [
    brandField,
    { key: "model", label: "Model", placeholder: "PlayStation 5, Xbox Series X", required: true },
    { key: "storage", label: "Storage", placeholder: "825GB, 1TB" },
    { key: "includedGames", label: "Included Games", placeholder: "Game titles included" },
    { key: "controllers", label: "Controllers", placeholder: "1 controller, 2 controllers" },
    conditionField,
    { key: "warranty", label: "Warranty", placeholder: "Manufacturer or seller warranty" },
  ], ["brand", "model", "condition"], ["brand", "model", "condition"]),
  simpleType("smart-watches", "Smart Watches", "Wearables", [
    brandField,
    { key: "model", label: "Model", placeholder: "Apple Watch Series 9", required: true },
    { key: "caseSize", label: "Case Size", placeholder: "41mm, 45mm" },
    { key: "connectivity", label: "Connectivity", type: "select", options: ["GPS / Bluetooth / Wi-Fi", "GPS + cellular", "Wi-Fi only", "Bluetooth only", "Unknown"], required: true, helpText: "Cellular watches can use a plan; GPS or Wi-Fi watches cannot use a standalone SIM plan." },
    { key: "carrierStatus", label: "Carrier / network lock (optional)", type: "select", options: ["Factory unlocked", "Locked to a carrier", "Unknown - not tested", "Not applicable - not cellular"] },
    { key: "activationLockStatus", label: "Account / activation lock (optional)", type: "select", options: ["No account lock - ready for new owner", "Account lock enabled", "Unknown - not checked", "Not applicable - device has no account lock feature", "Not applicable - new sealed device"] },
    { key: "battery", label: "Battery Life", placeholder: "18 hours" },
    conditionField,
    { key: "warranty", label: "Warranty", placeholder: "Manufacturer or seller warranty" },
  ], ["brand", "connectivity", "condition"], ["brand", "model", "connectivity", "condition"]),
  simpleType("speakers", "Speakers", "Audio", [
    brandField,
    { key: "speakerType", label: "Speaker Type", placeholder: "Bluetooth, soundbar, bookshelf" },
    { key: "connectivity", label: "Connectivity", placeholder: "Bluetooth, Wi-Fi, AUX" },
    { key: "powerOutput", label: "Power Output", placeholder: "20W, 100W" },
    { key: "battery", label: "Battery Life", placeholder: "12 hours" },
    conditionField,
  ], ["brand", "speakerType", "connectivity", "condition"], ["brand", "speakerType", "condition"]),
  simpleType("networking", "Networking", "Computer Accessories", [
    brandField,
    { key: "deviceType", label: "Device Type", placeholder: "Router, extender, switch", required: true },
    { key: "speed", label: "Speed", placeholder: "AX3000, Gigabit" },
    { key: "bands", label: "Bands", placeholder: "Dual-band, tri-band" },
    { key: "ports", label: "Ports", placeholder: "4 LAN, 1 WAN" },
    conditionField,
  ], ["brand", "deviceType", "condition"], ["brand", "deviceType", "condition"]),
  simpleType("computer-parts", "Computer Parts", "Computer Parts", [
    brandField,
    { key: "partType", label: "Part Type", placeholder: "CPU, GPU, RAM, SSD", required: true },
    { key: "compatibility", label: "Compatibility", placeholder: "AM5, DDR5, PCIe 4.0" },
    { key: "capacity", label: "Capacity", placeholder: "16GB, 1TB" },
    conditionField,
    { key: "warranty", label: "Warranty", placeholder: "Manufacturer or seller warranty" },
  ], ["brand", "partType", "condition"], ["brand", "partType", "condition"]),
  simpleType("electronics-accessories", "Accessories", "Accessories", [
    brandField,
    { key: "accessoryType", label: "Accessory Type", placeholder: "Charger, cable, case", required: true },
    { key: "compatibility", label: "Compatibility", placeholder: "USB-C, iPhone, Android" },
    colorField,
    conditionField,
  ], ["brand", "accessoryType", "condition"], ["accessoryType", "condition"]),
  simpleType("home-appliances", "Home Appliances", "Home Appliances", [
    brandField,
    { key: "applianceType", label: "Appliance type", placeholder: "Refrigerator, microwave, washing machine", required: true },
    { key: "model", label: "Model", placeholder: "Model name or number", required: true },
    { key: "capacity", label: "Capacity", placeholder: "300L, 8kg, 25L" },
    { key: "powerSource", label: "Power source", placeholder: "220V electric, gas, battery" },
    { key: "energyRating", label: "Energy rating", placeholder: "A++, Energy Star, if applicable" },
    conditionField,
    { key: "warranty", label: "Warranty", placeholder: "Manufacturer or seller warranty" },
  ], ["brand", "applianceType", "condition"], ["applianceType", "model", "condition"])
);

CATEGORY_CONFIGS.fashion.productTypes.push(
  simpleType("mens-clothing", "Men's Clothing", "Clothing", apparelFields(), ["brand", "size", "color", "material"], ["size", "color", "material"]),
  simpleType("womens-clothing", "Women's Clothing", "Clothing", apparelFields(), ["brand", "size", "color", "material"], ["size", "color", "material"]),
  simpleType("kids-clothing", "Kids' Clothing", "Kids", apparelFields([{ key: "ageRange", label: "Age Range", placeholder: "2-3Y, 6-7Y", required: true }]), ["size", "color", "material"], ["size", "color", "material", "ageRange"]),
  simpleType("underwear", "Underwear", "Clothing", apparelFields([{ key: "packCount", label: "Pack Count", placeholder: "Single, 3 pack" }]), ["brand", "size", "color", "material"], ["size", "material"]),
  simpleType("sportswear", "Sportswear", "Clothing", apparelFields([{ key: "sportType", label: "Sport Type", placeholder: "Running, training, football" }]), ["brand", "size", "color", "material"], ["size", "color", "material"]),
  simpleType("traditional-wear", "Traditional Wear", "Clothing", apparelFields([{ key: "origin", label: "Style / Origin", placeholder: "Agbada, kaftan, kimono" }]), ["size", "color", "material"], ["size", "color", "material"]),
  simpleType("sneakers", "Sneakers", "Shoes", shoeFields(), ["brand", "gender", "shoeSize", "color"], ["shoeSize", "color", "material"]),
  simpleType("boots", "Boots", "Shoes", shoeFields(), ["brand", "gender", "shoeSize", "color"], ["shoeSize", "color", "material"]),
  simpleType("sandals", "Sandals", "Shoes", shoeFields("Sandal Size"), ["brand", "gender", "shoeSize", "color"], ["shoeSize", "color", "material"]),
  simpleType("wallets", "Wallets", "Bags & Accessories", [
    brandField,
    { key: "material", label: "Material", placeholder: "Leather, canvas, nylon", required: true },
    colorField,
    { key: "walletType", label: "Wallet Type", placeholder: "Bifold, card holder, clutch" },
    { key: "dimensions", label: "Dimensions", placeholder: "11 x 9 cm" },
  ], ["brand", "material", "color"], ["material", "color"]),
  simpleType("sunglasses", "Sunglasses", "Accessories", [
    brandField,
    { key: "frameMaterial", label: "Frame Material", placeholder: "Acetate, metal" },
    { key: "lensType", label: "Lens Type", placeholder: "Polarized, UV400", required: true },
    { key: "frameColor", label: "Frame Color", placeholder: "Black, gold" },
    { key: "lensColor", label: "Lens Color", placeholder: "Brown, black" },
    { key: "frameShape", label: "Frame Shape", placeholder: "Aviator, round, square" },
  ], ["brand", "lensType", "frameShape"], ["lensType"]),
  simpleType("hats", "Hats", "Accessories", [
    brandField,
    { key: "hatType", label: "Hat Type", placeholder: "Cap, beanie, fedora", required: true },
    { key: "size", label: "Size", placeholder: "One size, adjustable" },
    colorField,
    { key: "material", label: "Material", placeholder: "Cotton, wool, straw" },
  ], ["hatType", "color", "material"], ["hatType", "color"]),
  simpleType("belts", "Belts", "Accessories", [
    brandField,
    { key: "beltSize", label: "Belt Size", placeholder: "32, 34, 90cm", required: true },
    { key: "material", label: "Material", placeholder: "Leather, fabric", required: true },
    colorField,
    { key: "buckleType", label: "Buckle Type", placeholder: "Pin, automatic, reversible" },
  ], ["brand", "beltSize", "material", "color"], ["beltSize", "material", "color"])
);

CATEGORY_CONFIGS.home.productTypes.push(
  simpleType("furniture-home", "Furniture", "Furniture", homeFields([{ key: "assemblyRequired", label: "Assembly Required", type: "select", options: ["Yes", "No", "Partial"] }]), ["material", "color", "style", "roomType"], ["material", "dimensions"]),
  simpleType("lighting", "Lighting", "Lighting", homeFields([{ key: "voltage", label: "Voltage", placeholder: "110V, 220V" }, { key: "bulbType", label: "Bulb Type", placeholder: "LED, E27" }]), ["material", "color", "style", "roomType"], ["material", "dimensions"]),
  simpleType("kitchen", "Kitchen", "Kitchen", homeFields([{ key: "dishwasherSafe", label: "Dishwasher Safe", type: "select", options: ["Yes", "No"] }]), ["material", "color", "style"], ["material", "dimensions"]),
  simpleType("bedding", "Bedding", "Bedroom", homeFields([{ key: "bedSize", label: "Bed Size", placeholder: "Queen, king, twin", required: true }, { key: "threadCount", label: "Thread Count", placeholder: "300TC" }]), ["material", "color", "bedSize"], ["material", "bedSize", "color"]),
  simpleType("bathroom", "Bathroom", "Bathroom", homeFields([{ key: "waterResistant", label: "Water Resistant", type: "select", options: ["Yes", "No"] }]), ["material", "color", "style"], ["material", "dimensions"]),
  simpleType("garden", "Garden", "Garden", homeFields([{ key: "outdoorUse", label: "Outdoor Use", type: "select", options: ["Yes", "No"] }]), ["material", "color", "style"], ["material", "dimensions"])
);

CATEGORY_CONFIGS.beauty.productTypes.push(
  simpleType("makeup", "Makeup", "Makeup", [
    brandField,
    { key: "shade", label: "Shade", placeholder: "Nude, deep tan", required: true },
    { key: "finish", label: "Finish", placeholder: "Matte, dewy, satin" },
    { key: "skinType", label: "Skin Type", placeholder: "All, oily, dry" },
    { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "Ingredient list" },
    { key: "expiryDate", label: "Expiry Date", type: "date" },
  ], ["brand", "shade", "finish"], ["brand", "shade"]),
  simpleType("skincare", "Skincare", "Skincare", [
    brandField,
    { key: "skinType", label: "Skin Type", placeholder: "Dry, oily, sensitive", required: true },
    { key: "volume", label: "Volume", placeholder: "30ml, 100ml" },
    { key: "benefits", label: "Benefits", placeholder: "Hydrating, brightening" },
    { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "Ingredient list" },
    { key: "expiryDate", label: "Expiry Date", type: "date" },
  ], ["brand", "skinType"], ["brand", "skinType"]),
  simpleType("hair-care", "Hair Care", "Hair Care", [
    brandField,
    { key: "hairType", label: "Hair Type", placeholder: "Curly, straight, coily", required: true },
    { key: "volume", label: "Volume", placeholder: "250ml" },
    { key: "benefits", label: "Benefits", placeholder: "Moisturizing, anti-dandruff" },
    { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "Ingredient list" },
    { key: "expiryDate", label: "Expiry Date", type: "date" },
  ], ["brand", "hairType"], ["brand", "hairType"]),
  simpleType("mens-grooming", "Men's Grooming", "Men's Grooming", [
    brandField,
    { key: "productForm", label: "Product Form", placeholder: "Cream, oil, balm" },
    { key: "volume", label: "Volume", placeholder: "100ml" },
    { key: "skinType", label: "Skin Type", placeholder: "All, sensitive" },
    { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "Ingredient list" },
  ], ["brand", "productForm"], ["brand"]),
  simpleType("beauty-tools", "Beauty Tools", "Beauty Tools", [
    brandField,
    { key: "toolType", label: "Tool Type", placeholder: "Brush, dryer, curler", required: true },
    { key: "material", label: "Material", placeholder: "Synthetic fiber, ceramic" },
    { key: "powerSource", label: "Power Source", placeholder: "Manual, plug-in, rechargeable" },
    conditionField,
  ], ["brand", "toolType", "condition"], ["toolType", "condition"])
);

CATEGORY_CONFIGS.general.productTypes.push(
  simpleType("toys", "Toys", "Toys", [
    brandField,
    { key: "ageRange", label: "Age Range", placeholder: "3+, 6-8 years", required: true },
    { key: "material", label: "Material", placeholder: "Plastic, wood, plush" },
    { key: "safetyStandard", label: "Safety Standard", placeholder: "CE, ASTM" },
    conditionField,
  ], ["brand", "ageRange", "condition"], ["ageRange", "condition"]),
  simpleType("baby-products", "Baby Products", "Baby", [
    brandField,
    { key: "ageRange", label: "Age Range", placeholder: "0-6 months, toddler", required: true },
    { key: "material", label: "Material", placeholder: "Cotton, silicone, plastic" },
    { key: "safetyStandard", label: "Safety Standard", placeholder: "BPA-free, CE" },
    conditionField,
  ], ["brand", "ageRange", "condition"], ["ageRange", "condition"]),
  simpleType("sports", "Sports", "Sports", [
    brandField,
    { key: "sportType", label: "Sport Type", placeholder: "Football, running, yoga", required: true },
    { key: "size", label: "Size", placeholder: "M, L, standard" },
    { key: "material", label: "Material", placeholder: "Rubber, foam, steel" },
    conditionField,
  ], ["brand", "sportType", "condition"], ["sportType", "condition"]),
  simpleType("automotive", "Automotive", "Automotive", [
    brandField,
    { key: "partType", label: "Part Type", placeholder: "Brake pad, filter, bulb", required: true },
    { key: "compatibility", label: "Vehicle Compatibility", placeholder: "Toyota Corolla 2014-2019", required: true },
    { key: "partNumber", label: "Part Number", placeholder: "OEM or aftermarket part number" },
    conditionField,
  ], ["brand", "partType", "condition"], ["partType", "compatibility", "condition"]),
  simpleType("vehicles", "Vehicles", "Vehicles", [
    { key: "make", label: "Make", placeholder: "Toyota, Honda, Ford", required: true },
    { key: "model", label: "Model", placeholder: "Corolla, Civic, Ranger", required: true },
    { key: "year", label: "Year", placeholder: "2020", required: true },
    { key: "mileage", label: "Mileage", placeholder: "45,000 km", required: true },
    { key: "fuelType", label: "Fuel type", type: "select", options: ["Petrol", "Diesel", "Hybrid", "Electric", "Gas", "Other"], required: true },
    { key: "transmission", label: "Transmission", type: "select", options: ["Automatic", "Manual", "Other"], required: true },
    { key: "driveSide", label: "Drive side", type: "select", options: ["Left-hand drive", "Right-hand drive"], required: true },
    { key: "vehicleCondition", label: "Vehicle condition", type: "select", options: ["New", "Used", "Salvage / repair needed"], required: true },
    { key: "vinStatus", label: "VIN availability", type: "select", options: ["Available privately on request", "Not available"], required: true },
  ], ["make", "model", "year", "fuelType"], ["make", "model", "year", "mileage", "fuelType", "transmission", "driveSide", "vehicleCondition", "vinStatus"]),
  simpleType("food-drink", "Food & Drink", "Food & Drink", [
    brandField,
    { key: "productForm", label: "Product form", placeholder: "Snack, drink, canned, dried", required: true },
    { key: "netQuantity", label: "Net quantity", placeholder: "500g, 330ml, 12-pack", required: true },
    { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "Full ingredient list", required: true },
    { key: "allergens", label: "Allergen information", placeholder: "Contains nuts, dairy; or None declared", required: true },
    { key: "expiryDate", label: "Best-before / expiry date", type: "date", required: true },
    { key: "countryOfOrigin", label: "Country of origin", placeholder: "Nigeria, Italy, Ghana", required: true },
  ], ["brand", "productForm"], ["productForm", "netQuantity", "ingredients", "allergens", "expiryDate", "countryOfOrigin"]),
  simpleType("books", "Books", "Books", [
    { key: "author", label: "Author", placeholder: "Author name", required: true },
    { key: "publisher", label: "Publisher", placeholder: "Publisher" },
    { key: "isbn", label: "ISBN", placeholder: "ISBN-10 or ISBN-13" },
    { key: "format", label: "Format", type: "select", options: ["Paperback", "Hardcover", "Ebook", "Audiobook"] },
    conditionField,
  ], ["author", "format", "condition"], ["author", "condition"]),
  simpleType("pet-supplies", "Pet Supplies", "Pet Supplies", [
    brandField,
    { key: "petType", label: "Pet Type", placeholder: "Dog, cat, bird", required: true },
    { key: "productForm", label: "Product Form", placeholder: "Food, toy, grooming" },
    { key: "size", label: "Size", placeholder: "Small, medium, large" },
    { key: "ingredients", label: "Ingredients", type: "textarea", placeholder: "For food or treats" },
  ], ["brand", "petType", "size"], ["petType"])
);

export const findCategoryConfig = (category?: { name?: string | null; slug?: string | null } | null) => {
  const normalized = (category?.slug || category?.name || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return Object.values(CATEGORY_CONFIGS).find(config => config.aliases.includes(normalized)) ?? CATEGORY_CONFIGS.general;
};

const PRODUCT_TYPES_BY_CATEGORY: Record<string, string[]> = {
  electronics: ["mobile-phones", "laptops", "audio", "tablets", "tvs", "cameras", "gaming-consoles", "smart-watches", "speakers", "networking", "computer-parts", "electronics-accessories"],
  computers: ["laptops", "networking", "computer-parts"],
  gaming: ["gaming-consoles"],
  "home-appliances": ["home-appliances"],
  "phones-accessories": ["mobile-phones", "phones", "tablets", "smart-watches", "audio", "electronics-accessories"],
  clothing: ["t-shirts", "mens-clothing", "womens-clothing", "kids-clothing", "underwear", "sportswear", "traditional-wear"],
  bags: ["bags", "wallets"],
  glasses: ["glasses", "sunglasses"],
  shoes: ["shoes", "sneakers", "boots", "sandals"],
  "home-decor": ["rugs", "curtains", "lamps", "wall-art", "decorative-items", "storage"],
  furniture: ["furniture"],
  kitchen: ["kitchen"],
  "pet-supplies": ["pet-supplies"],
  "baby-products": ["baby-products"],
  watches: ["watches"],
  jewelry: ["rings", "necklaces", "bracelets-earrings"],
  beauty: ["perfume", "body-scrub", "nail-products", "makeup", "skincare", "hair-care", "mens-grooming", "beauty-tools"],
  "health-beauty": ["perfume", "body-scrub", "nail-products", "makeup", "skincare", "hair-care", "mens-grooming", "beauty-tools"],
  books: ["books"], toys: ["toys"], sports: ["sports"], "auto-parts": ["automotive"], vehicles: ["vehicles"], "food-drink": ["food-drink"],
};

const normalizeCategoryKey = (category?: { name?: string | null; slug?: string | null } | null) =>
  (category?.slug || category?.name || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Restrict a category to its valid product types so unrelated form fields can
 * never be selected (for example, phone specifications for clothing). */
export const getProductTypesForCategory = (category?: { name?: string | null; slug?: string | null } | null) => {
  const categoryConfig = findCategoryConfig(category);
  const allowedKeys = PRODUCT_TYPES_BY_CATEGORY[normalizeCategoryKey(category)];
  return allowedKeys ? categoryConfig.productTypes.filter(type => allowedKeys.includes(type.key)) : categoryConfig.productTypes;
};

export const getProductType = (variants: unknown): { key: string; label: string; subcategory?: string } | null => {
  if (!variants || typeof variants !== "object") return null;
  const productType = (variants as { productType?: unknown }).productType;
  if (!productType || typeof productType !== "object") return null;
  const key = (productType as { key?: unknown }).key;
  const label = (productType as { label?: unknown }).label;
  const subcategory = (productType as { subcategory?: unknown }).subcategory;
  if (typeof key !== "string" || typeof label !== "string") return null;
  return { key, label, ...(typeof subcategory === "string" ? { subcategory } : {}) };
};

export const findProductTypeConfig = (
  category?: { name?: string | null; slug?: string | null } | null,
  productTypeKey?: string | null
) => {
  const categoryConfig = findCategoryConfig(category);
  const productTypes = getProductTypesForCategory(category);
  return productTypes.find(type => type.key === productTypeKey) ?? productTypes[0] ?? {
    key: "general",
    label: "General Product",
    fields: categoryConfig.fields,
    filters: categoryConfig.filters,
  };
};

export const getSubcategories = (category?: { name?: string | null; slug?: string | null } | null) => {
  const config = findCategoryConfig(category);
  return Array.from(new Set(config.productTypes.map(type => type.subcategory || "General")));
};

export const getProductTypesForSubcategory = (
  category?: { name?: string | null; slug?: string | null } | null,
  subcategory?: string | null
) => {
  const config = findCategoryConfig(category);
  if (!subcategory) return config.productTypes;
  return config.productTypes.filter(type => (type.subcategory || "General") === subcategory);
};

export const getRequiredFields = (productType: ProductTypeConfig) => {
  const required = new Set(productType.requiredFields || []);
  productType.fields.forEach(field => {
    if (field.required) required.add(field.key);
  });
  return Array.from(required);
};

export const getCategoryAttributes = (variants: unknown): Record<string, string> => {
  if (!variants || typeof variants !== "object") return {};
  const attrs = (variants as { categoryAttributes?: unknown }).categoryAttributes;
  if (!attrs || typeof attrs !== "object") return {};
  return Object.entries(attrs as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string" && value.trim()) acc[key] = value.trim();
    return acc;
  }, {});
};

export const getProductVideos = (variants: unknown): string[] => {
  if (!variants || typeof variants !== "object") return [];
  const videos = (variants as { productVideos?: unknown }).productVideos;
  return Array.isArray(videos) ? videos.filter((url): url is string => typeof url === "string" && url.trim().length > 0) : [];
};

export const mergeCategoryAttributes = (
  variants: unknown,
  categoryAttributes: Record<string, string>,
  productType?: { key: string; label: string; subcategory?: string },
  productVideos?: string[]
) => ({
  ...(variants && typeof variants === "object" ? variants as Record<string, unknown> : {}),
  categoryAttributes,
  ...(productType ? { productType } : {}),
  ...(productVideos !== undefined ? { productVideos } : {}),
});
