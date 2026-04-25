import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  DEFAULT_SOCIAL_IMAGE,
  SITE_NAME,
  buildStructuredData,
  canonicalUrl,
  getSeoPage,
} from "@shared/seo";

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element?.setAttribute(name, value);
  });
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

function upsertStructuredData(data: unknown) {
  let element = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"][data-managed-seo="true"]',
  );
  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.dataset.managedSeo = "true";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

export default function Seo() {
  const [location] = useLocation();

  useEffect(() => {
    const page = getSeoPage(location);
    const url = canonicalUrl(page.path);
    const robots = page.robots || "index,follow";
    const keywords = page.keywords.filter(Boolean).join(", ");

    document.title = page.title;
    upsertCanonical(url);
    upsertMeta('meta[name="description"]', { name: "description", content: page.description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: robots });

    const keywordElement = document.head.querySelector<HTMLMetaElement>('meta[name="keywords"]');
    if (keywords) {
      upsertMeta('meta[name="keywords"]', { name: "keywords", content: keywords });
    } else {
      keywordElement?.remove();
    }

    upsertMeta('meta[property="og:title"]', { property: "og:title", content: page.title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: page.description });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: DEFAULT_SOCIAL_IMAGE });
    upsertMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: `${SITE_NAME} logo` });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });

    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: page.title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: page.description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: DEFAULT_SOCIAL_IMAGE });
    upsertMeta('meta[name="twitter:image:alt"]', { name: "twitter:image:alt", content: `${SITE_NAME} logo` });

    upsertStructuredData(buildStructuredData(page));
  }, [location]);

  return null;
}
