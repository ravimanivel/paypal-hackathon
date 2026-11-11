import OpenAI from "openai";
import { getServerEnv, isConfiguredValue } from "@/lib/env";
import { CurrencyCode, ProductProposalItem } from "@/types";
import { toMinorUnits, formatCurrency } from "@/lib/utils/currency";

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  merchant: string;
  merchantDomain: string;
  priceInrMajor: number;
  specs: string[];
  rating: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK";
  summary: string;
  tags: string[];
}

/**
 * Clearly labelled sample/demo product catalog covering all 4 Hackathon Demo Scenarios:
 * 1. Auto-Approved Safe Purchases (under ₹10,000 from trusted merchants)
 * 2. Manual Approval Purchases (laptops under ₹80,000, monitors, accessories)
 * 3. Policy Violations (workstations > ₹80,000 max limit, or Blocked Merchants)
 * 4. Suspicious / Untrusted Merchant items
 */
const SAMPLE_PRODUCT_CATALOG: CatalogEntry[] = [
  {
    id: "prod-laptop-lenovo-slim5",
    name: "Lenovo IdeaPad Slim 5 Gen 9 (14-inch OLED)",
    category: "Laptops",
    merchant: "Lenovo Store",
    merchantDomain: "lenovo.com",
    priceInrMajor: 64990,
    specs: [
      "Intel Core Ultra 5 125H Processor",
      "16GB LPDDR5X RAM, 512GB NVMe SSD",
      "14\" WUXGA OLED 400nits Display",
      "57Wh Battery, Rapid Charge Boost, 1.46 kg",
    ],
    rating: 4.7,
    stockStatus: "IN_STOCK",
    summary:
      "Best all-around productivity laptop under ₹80,000 with an OLED display and strong battery life.",
    tags: ["laptop", "ultrabook", "oled", "coding", "student", "office", "lenovo"],
  },
  {
    id: "prod-laptop-dell-inspiron14",
    name: "Dell Inspiron 14 Plus 7440",
    category: "Laptops",
    merchant: "Dell India",
    merchantDomain: "dell.com",
    priceInrMajor: 72500,
    specs: [
      "Intel Core i7-13620H (10 Cores)",
      "16GB DDR5 RAM, 1TB PCIe NVMe SSD",
      "14\" 2.2K Anti-Glare IPS 300nits",
      "ExpressCharge, Aluminum Chassis",
    ],
    rating: 4.6,
    stockStatus: "IN_STOCK",
    summary:
      "High-performance 1TB storage laptop under ₹80,000 from a verified enterprise merchant.",
    tags: ["laptop", "dell", "inspiron", "business", "1tb", "coding"],
  },
  {
    id: "prod-laptop-macbook-air-m2",
    name: "Apple MacBook Air 13-inch (M2 Chip)",
    category: "Laptops",
    merchant: "Apple Store",
    merchantDomain: "apple.com",
    priceInrMajor: 76900,
    specs: [
      "Apple M2 8-Core CPU, 8-Core GPU",
      "16GB Unified Memory, 256GB SSD",
      "13.6\" Liquid Retina Display",
      "Up to 18 hours battery life, MagSafe 3",
    ],
    rating: 4.9,
    stockStatus: "IN_STOCK",
    summary:
      "Premium Apple silicon laptop right within the ₹80,000 budget ceiling.",
    tags: ["laptop", "macbook", "apple", "m2", "developer"],
  },
  {
    id: "prod-audio-sony-ch720n",
    name: "Sony WH-CH720N Wireless Noise Cancelling Headphones",
    category: "Accessories",
    merchant: "Amazon India",
    merchantDomain: "amazon.in",
    priceInrMajor: 7990,
    specs: [
      "Integrated Processor V1 Noise Cancelling",
      "Up to 35-hour battery life",
      "Multipoint Bluetooth Connection",
      "Super lightweight 192g ergonomic design",
    ],
    rating: 4.6,
    stockStatus: "IN_STOCK",
    summary:
      "Under ₹10,000 trusted-merchant accessory — qualifies for instant AUTO_APPROVED under the Balanced policy.",
    tags: ["headphones", "audio", "sony", "wireless", "accessory", "safe", "auto"],
  },
  {
    id: "prod-keychron-k2-pro",
    name: "Keychron K2 Pro QMK/VIA Wireless Mechanical Keyboard",
    category: "Accessories",
    merchant: "Croma",
    merchantDomain: "croma.com",
    priceInrMajor: 8499,
    specs: [
      "QMK/VIA Programmable Macros",
      "Hot-swappable Keychron K Pro Red Switches",
      "PBT Double-shot Keycaps, Aluminum Frame",
      "Bluetooth 5.1 & USB Type-C Wired",
    ],
    rating: 4.8,
    stockStatus: "IN_STOCK",
    summary:
      "Developer mechanical keyboard under ₹10,000 from a trusted merchant (Auto-Approved demo item).",
    tags: ["keyboard", "accessory", "mechanical", "keychron", "safe", "auto", "mouse"],
  },
  {
    id: "prod-laptop-rog-strix-overlimit",
    name: "ASUS ROG Strix SCAR 16 RTX 4080 Workstation",
    category: "Laptops",
    merchant: "Reliance Digital",
    merchantDomain: "reliancedigital.in",
    priceInrMajor: 135000,
    specs: [
      "Intel Core i9-14900HX (24 Cores)",
      "32GB DDR5 RAM, 2TB RAID0 NVMe SSD",
      "NVIDIA GeForce RTX 4080 12GB GDDR6",
      "16\" 240Hz Mini-LED Nebula HDR Display",
    ],
    rating: 4.8,
    stockStatus: "LOW_STOCK",
    summary:
      "High-end workstation at ₹1,35,000 — demonstrates AgentGuard Firewall deterministic BLOCKED when exceeding an ₹80,000 max transaction policy.",
    tags: ["gaming", "workstation", "expensive", "overlimit", "violation", "laptop", "rtx"],
  },
  {
    id: "prod-blocked-merchant-gpu",
    name: "Imported RTX 4070 Ti Super OEM Graphics Card",
    category: "Electronics",
    merchant: "DarkMarket Electronics",
    merchantDomain: "darkmarket-hw.example",
    priceInrMajor: 42000,
    specs: [
      "16GB GDDR6X VRAM Bulk OEM Packaging",
      "No Official Manufacturer Warranty",
      "Unverified Third-Party Marketplace Seller",
    ],
    rating: 3.1,
    stockStatus: "LOW_STOCK",
    summary:
      "Listed by a blocked merchant ('DarkMarket Electronics') — demonstrates immediate Firewall BLOCKED & High Risk alert.",
    tags: ["gpu", "darkmarket", "blocked", "suspicious", "untrusted", "graphics"],
  },
];

function convertCatalogItemToCurrency(
  item: CatalogEntry,
  currency: CurrencyCode,
  matchScore = 95
): ProductProposalItem {
  const rate = currency === "INR" ? 1 : 0.012;
  const priceMajor =
    currency === "INR"
      ? item.priceInrMajor
      : Math.max(15, Math.round(item.priceInrMajor * rate));

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    merchant: item.merchant,
    merchantDomain: item.merchantDomain,
    priceMajor,
    priceMinor: toMinorUnits(priceMajor),
    currency,
    specs: item.specs,
    rating: item.rating,
    stockStatus: item.stockStatus,
    isSampleData: true,
    matchScore,
    summary: item.summary,
  };
}

export function extractShoppingIntent(
  prompt: string,
  defaultCurrency: CurrencyCode = "INR"
) {
  const lower = prompt.toLowerCase();

  let category = "Laptops";
  if (
    lower.includes("headphone") ||
    lower.includes("audio") ||
    lower.includes("earbud") ||
    lower.includes("keyboard") ||
    lower.includes("accessory") ||
    lower.includes("mouse")
  ) {
    category = "Accessories";
  } else if (
    lower.includes("gpu") ||
    lower.includes("graphics") ||
    lower.includes("darkmarket")
  ) {
    category = "Electronics";
  }

  // Extract budget number (handles ₹80,000, 80000, 1,35,000, $1000, etc.)
  const budgetMatch = prompt.match(/(?:₹|\$|€|£|rs\.?|inr|usd|under|below|around|for)\s*([\d,]{3,9})/i) ||
    prompt.match(/\b([\d,]{4,9})\b/);
  let budgetMajor: number | undefined;
  if (budgetMatch?.[1]) {
    const cleaned = Number(budgetMatch[1].replace(/,/g, ""));
    if (Number.isFinite(cleaned) && cleaned > 0) {
      budgetMajor = cleaned;
    }
  }

  const requirements: string[] = [];
  if (lower.includes("16gb")) requirements.push("16GB RAM");
  if (lower.includes("oled")) requirements.push("OLED Display");
  if (lower.includes("gaming") || lower.includes("rtx"))
    requirements.push("Dedicated GPU");
  if (lower.includes("mac") || lower.includes("apple"))
    requirements.push("Apple Silicon");
  if (lower.includes("noise") || lower.includes("wireless"))
    requirements.push("Wireless ANC");
  if (requirements.length === 0) {
    requirements.push("Verified Merchant", "High Price-to-Performance");
  }

  return {
    category,
    budgetMajor,
    currency: defaultCurrency,
    requirements,
  };
}

export async function generateShoppingAgentResponse(params: {
  userMessage: string;
  currency: CurrencyCode;
  maxPolicyLimitMajor: number;
  autoApprovalLimitMajor: number;
}): Promise<{
  assistantMessage: string;
  extractedIntent: {
    category: string;
    budgetMajor?: number;
    currency: CurrencyCode;
    requirements: string[];
  };
  proposals: ProductProposalItem[];
}> {
  const intent = extractShoppingIntent(params.userMessage, params.currency);
  const lower = params.userMessage.toLowerCase();

  let selectedEntries: CatalogEntry[] = [];

  if (lower.includes("darkmarket") || lower.includes("blocked")) {
    selectedEntries = SAMPLE_PRODUCT_CATALOG.filter(
      (i) => i.id === "prod-blocked-merchant-gpu"
    );
  } else if (
    lower.includes("1,35,000") ||
    lower.includes("135000") ||
    lower.includes("above") ||
    lower.includes("exceed") ||
    lower.includes("workstation") ||
    lower.includes("rog") ||
    (intent.budgetMajor && intent.budgetMajor > 90000)
  ) {
    selectedEntries = [
      SAMPLE_PRODUCT_CATALOG.find(
        (i) => i.id === "prod-laptop-rog-strix-overlimit"
      )!,
      SAMPLE_PRODUCT_CATALOG.find((i) => i.id === "prod-laptop-macbook-air-m2")!,
    ];
  } else if (
    intent.category === "Accessories" ||
    (intent.budgetMajor && intent.budgetMajor <= 12000)
  ) {
    selectedEntries = SAMPLE_PRODUCT_CATALOG.filter(
      (i) => i.category === "Accessories"
    );
  } else {
    // Default laptop comparison under ₹80,000 (+ show the over-limit option if user wants full comparison)
    selectedEntries = SAMPLE_PRODUCT_CATALOG.filter(
      (i) =>
        i.id === "prod-laptop-lenovo-slim5" ||
        i.id === "prod-laptop-dell-inspiron14" ||
        i.id === "prod-laptop-macbook-air-m2"
    );
  }

  const proposals = selectedEntries.map((item, idx) =>
    convertCatalogItemToCurrency(item, params.currency, 96 - idx * 3)
  );

  const env = getServerEnv();
  let assistantMessage = "";

  if (isConfiguredValue(env.OPENAI_API_KEY)) {
    try {
      const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `You are the AgentGuard AI Shopping Agent.
Your job is to help the customer compare the discovered sample products, explain why they match their budget and requirements, and remind them that selecting a product will submit a Purchase Proposal to the AgentGuard Financial Firewall (you never execute payments directly).
Keep your response concise (3-5 sentences), structured, and helpful.`,
          },
          {
            role: "user",
            content: `Customer request: "${params.userMessage}"
Extracted budget: ${
              intent.budgetMajor
                ? formatCurrency(intent.budgetMajor, params.currency)
                : "Flexible"
            }
User Policy Max Limit: ${formatCurrency(
              params.maxPolicyLimitMajor,
              params.currency
            )} (Auto-approval under ${formatCurrency(
              params.autoApprovalLimitMajor,
              params.currency
            )})
Matching Sample Products: ${JSON.stringify(
              proposals.map((p) => ({
                name: p.name,
                merchant: p.merchant,
                price: formatCurrency(p.priceMajor, p.currency),
                summary: p.summary,
              }))
            )}`,
          },
        ],
      });
      assistantMessage = completion.choices[0]?.message?.content?.trim() || "";
    } catch {
      // Fallback to deterministic explanation below
    }
  }

  if (!assistantMessage) {
    const budgetText = intent.budgetMajor
      ? `within your ${formatCurrency(intent.budgetMajor, params.currency)} budget`
      : `matching your ${intent.category.toLowerCase()} criteria`;
    assistantMessage = `I analyzed your request for ${intent.category} ${budgetText} and compared ${proposals.length} sample options. Select any product below to generate a Purchase Proposal and submit it to the AgentGuard Financial Firewall for policy verification and risk analysis. Remember: as an AI agent, I cannot execute payments directly — AgentGuard enforces your spending rules before any PayPal checkout occurs.`;
  }

  return {
    assistantMessage,
    extractedIntent: intent,
    proposals,
  };
}

