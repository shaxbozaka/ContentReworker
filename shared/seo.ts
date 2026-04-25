export const SITE_URL = "https://aicontentrepurposer.com";
export const SITE_NAME = "Content Reworker";
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/images/logo.png`;

export const SEO_START_MARKER = "<!-- SEO_START -->";
export const SEO_END_MARKER = "<!-- SEO_END -->";

type RobotsDirective = "index,follow" | "noindex,follow" | "noindex,nofollow";

export interface SeoPage {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  robots?: RobotsDirective;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
  featureList?: string[];
}

const defaultFeatureList = [
  "Transform long-form content into LinkedIn posts",
  "Generate three hook variations per post",
  "Create posts for LinkedIn, X, Threads, Instagram, and Email",
  "Publish or schedule LinkedIn posts",
  "Track creators for personalized content ideas",
];

export const seoPages: Record<string, SeoPage> = {
  "/": {
    path: "/",
    title: "Content Reworker | AI LinkedIn Post Generator",
    description:
      "Turn articles, YouTube transcripts, and podcasts into LinkedIn-ready posts with AI hooks, editing tools, scheduling, and creator-inspired ideas.",
    keywords: [
      "AI LinkedIn post generator",
      "LinkedIn content repurposing",
      "content reworker",
      "viral LinkedIn hooks",
      "AI content repurposer",
    ],
    changefreq: "weekly",
    priority: 1.0,
    featureList: defaultFeatureList,
  },
  "/linkedin-post-generator": {
    path: "/linkedin-post-generator",
    title: "Free LinkedIn Post Generator | Content Reworker",
    description:
      "Generate polished LinkedIn posts from blogs, transcripts, podcasts, and rough ideas. Get three hook options and copy-ready formatting.",
    keywords: [
      "LinkedIn post generator",
      "free LinkedIn post generator",
      "AI LinkedIn generator",
      "LinkedIn hook generator",
      "B2B content generator",
    ],
    changefreq: "weekly",
    priority: 0.9,
    featureList: [
      "Generate LinkedIn posts from long-form content",
      "Create three hook variations",
      "Format posts for readability",
      "Suggest hashtags and calls to action",
      "Copy, publish, or schedule finished posts",
    ],
  },
  "/blog-to-twitter": {
    path: "/blog-to-twitter",
    title: "Blog to Twitter Thread Converter | Content Reworker",
    description:
      "Convert blog posts and articles into X/Twitter threads, LinkedIn posts, and short social content with AI-powered hooks and structure.",
    keywords: [
      "blog to Twitter converter",
      "blog to X thread",
      "Twitter thread generator",
      "AI thread generator",
      "repurpose blog content",
    ],
    changefreq: "monthly",
    priority: 0.8,
    featureList: [
      "Convert blogs into X/Twitter threads",
      "Repurpose articles into social posts",
      "Generate opening hooks",
      "Create platform-specific formatting",
      "Preserve the source idea while shortening the format",
    ],
  },
  "/youtube-to-social": {
    path: "/youtube-to-social",
    title: "YouTube to Social Content Repurposer | Content Reworker",
    description:
      "Turn YouTube transcripts into LinkedIn posts, X/Twitter threads, Instagram captions, and email content from one workflow.",
    keywords: [
      "YouTube to social content",
      "YouTube transcript repurposer",
      "YouTube to LinkedIn post",
      "video content repurposing",
      "AI YouTube repurposer",
    ],
    changefreq: "monthly",
    priority: 0.8,
    featureList: [
      "Repurpose YouTube transcripts",
      "Create LinkedIn posts from video ideas",
      "Generate X/Twitter threads",
      "Draft Instagram captions and email content",
      "Extract reusable ideas from long-form video",
    ],
  },
  "/pricing": {
    path: "/pricing",
    title: "Pricing | Content Reworker",
    description:
      "Start free with the LinkedIn post generator. Upgrade to Pro for unlimited posts, scheduling, AI images, and content pipelines.",
    keywords: ["Content Reworker pricing", "LinkedIn generator pricing", "AI content tool pricing"],
    changefreq: "monthly",
    priority: 0.7,
  },
  "/trending": {
    path: "/trending",
    title: "Viral Content Ideas Feed | Content Reworker",
    description:
      "Find content ideas from creators you track, ranked by topic overlap, freshness, engagement velocity, and your feedback.",
    keywords: ["viral content ideas", "creator ideas feed", "LinkedIn content ideas", "content inspiration"],
    robots: "noindex,follow",
  },
  "/creators": {
    path: "/creators",
    title: "Creator Tracking | Content Reworker",
    description:
      "Track YouTube and social creators so Content Reworker can surface personalized content ideas for your niche.",
    keywords: ["creator tracking", "content inspiration", "YouTube subscriptions content ideas"],
    robots: "noindex,follow",
  },
  "/generate": {
    path: "/generate",
    title: "AI Image Generator | Content Reworker",
    description: "Generate images for your social content workflow with Content Reworker Pro.",
    keywords: ["AI image generator", "social media image generator"],
    robots: "noindex,follow",
  },
  "/accounts": {
    path: "/accounts",
    title: "Account Settings | Content Reworker",
    description: "Manage your Content Reworker account, connections, billing, and preferences.",
    keywords: [],
    robots: "noindex,nofollow",
  },
  "/history": {
    path: "/history",
    title: "Post History | Content Reworker",
    description: "Review your generated posts and previous transformations.",
    keywords: [],
    robots: "noindex,nofollow",
  },
  "/schedule": {
    path: "/schedule",
    title: "Schedule Posts | Content Reworker",
    description: "Manage your scheduled LinkedIn posts.",
    keywords: [],
    robots: "noindex,nofollow",
  },
  "/pipelines": {
    path: "/pipelines",
    title: "Content Pipelines | Content Reworker",
    description: "Manage automated content pipelines for your account.",
    keywords: [],
    robots: "noindex,nofollow",
  },
  "/privacy-policy": {
    path: "/privacy-policy",
    title: "Privacy Policy | Content Reworker",
    description: "Read the Content Reworker privacy policy and data handling commitments.",
    keywords: ["Content Reworker privacy policy"],
    changefreq: "yearly",
    priority: 0.3,
  },
  "/terms-of-service": {
    path: "/terms-of-service",
    title: "Terms of Service | Content Reworker",
    description: "Read the Content Reworker terms of service.",
    keywords: ["Content Reworker terms of service"],
    changefreq: "yearly",
    priority: 0.3,
  },
  "/refund-policy": {
    path: "/refund-policy",
    title: "Refund Policy | Content Reworker",
    description: "Read the Content Reworker refund policy for paid subscriptions.",
    keywords: ["Content Reworker refund policy"],
    changefreq: "yearly",
    priority: 0.3,
  },
  "/linkedin-api-tester": {
    path: "/linkedin-api-tester",
    title: "LinkedIn API Tester | Content Reworker",
    description: "Internal LinkedIn API testing utility.",
    keywords: [],
    robots: "noindex,nofollow",
  },
};

export function normalizeSeoPath(path: string): string {
  const rawPath = path.split("?")[0]?.split("#")[0] || "/";
  if (rawPath === "/") return "/";
  return rawPath.replace(/\/+$/, "") || "/";
}

export function canonicalUrl(path: string): string {
  const normalized = normalizeSeoPath(path);
  return normalized === "/" ? SITE_URL : `${SITE_URL}${normalized}`;
}

export function getSeoPage(path: string): SeoPage {
  const normalized = normalizeSeoPath(path);
  const page = seoPages[normalized];
  if (page) return page;

  return {
    ...seoPages["/"],
    path: normalized,
    title: "Content Reworker",
    description: "AI content repurposing tools for LinkedIn-first creators and teams.",
    robots: "noindex,follow",
  };
}

export function getIndexableSeoPages(): SeoPage[] {
  return Object.values(seoPages).filter((page) => !page.robots?.startsWith("noindex"));
}

export function buildStructuredData(page: SeoPage) {
  const url = canonicalUrl(page.path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: DEFAULT_SOCIAL_IMAGE,
          width: 512,
          height: 512,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        url: SITE_URL,
        description: seoPages["/"].description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: page.featureList || defaultFeatureList,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#software` },
      },
    ],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function renderSeoHead(path: string): string {
  const page = getSeoPage(path);
  const url = canonicalUrl(page.path);
  const robots = page.robots || "index,follow";
  const keywords = page.keywords.filter(Boolean).join(", ");

  const keywordMeta = keywords
    ? `    <meta name="keywords" content="${escapeHtml(keywords)}" />\n`
    : "";

  return `${SEO_START_MARKER}
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
${keywordMeta}    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${url}" />

    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:image" content="${DEFAULT_SOCIAL_IMAGE}" />
    <meta property="og:image:alt" content="${SITE_NAME} logo" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:site_name" content="${SITE_NAME}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${DEFAULT_SOCIAL_IMAGE}" />
    <meta name="twitter:image:alt" content="${SITE_NAME} logo" />

    <script type="application/ld+json" data-managed-seo="true">${escapeJsonForHtml(buildStructuredData(page))}</script>
${SEO_END_MARKER}`;
}

export function injectSeoHead(html: string, path: string): string {
  const head = renderSeoHead(path);
  const markerPattern = new RegExp(`${SEO_START_MARKER}[\\s\\S]*?${SEO_END_MARKER}`);
  if (markerPattern.test(html)) {
    return html.replace(markerPattern, head);
  }

  return html.replace("</head>", `${head}\n  </head>`);
}

// Inline styles (not Tailwind classes) so the fallback renders correctly even
// before the main stylesheet loads. Colors mirror the slate-900/600 + Inter
// stack so the visual swap when React mounts is minimal.
export function renderSeoBody(path: string): string {
  const page = getSeoPage(path);
  if (page.robots?.startsWith("noindex")) return "";

  // Strip the "| Content Reworker" suffix for cleaner h1 display.
  const headline = escapeHtml(page.title.split("|")[0].trim());
  const description = escapeHtml(page.description);
  const features =
    page.featureList && page.featureList.length
      ? `<ul style="text-align:left;max-width:34rem;margin:1.5rem auto 0;padding-left:1.25rem;color:#475569;font-size:1rem;line-height:1.7">${page.featureList
          .map((f) => `<li style="margin:0.35rem 0">${escapeHtml(f)}</li>`)
          .join("")}</ul>`
      : "";

  return `<div data-prerendered="seo-fallback" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2.5rem 1.5rem;text-align:center;font-family:'Inter',-apple-system,BlinkMacSystemFont,system-ui,sans-serif"><main style="max-width:48rem"><h1 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:800;margin:0 0 1rem;letter-spacing:-0.02em;color:#0f172a">${headline}</h1><p style="font-size:1.125rem;line-height:1.6;color:#475569;margin:0">${description}</p>${features}</main></div>`;
}

// Combined: meta/head + prerendered body skeleton. Used by the SPA catch-all.
export function injectSeoSnapshot(html: string, path: string): string {
  const withHead = injectSeoHead(html, path);
  const body = renderSeoBody(path);
  if (!body) return withHead;
  return withHead.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}
