import { Link } from "wouter";
import { Linkedin, PenLine } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white" role="contentinfo" aria-label="Site footer">
      <div className="section-shell py-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_0.6fr_0.6fr]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white">
                <PenLine className="h-5 w-5" />
              </div>
              <div>
                <span className="block font-black tracking-tight text-slate-950">Content Reworker</span>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">LinkedIn-first AI</span>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-6 text-slate-600">
              Turn long-form content into LinkedIn posts with hook variations, publishing controls, and creator workflow tools.
            </p>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-[rgb(var(--color-linkedin))]"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black text-slate-950">Product</h4>
            <nav aria-label="Product links">
              <ul className="space-y-3">
                <li>
                  <Link href="/pricing">
                    <span className="cursor-pointer text-sm font-semibold text-slate-600 transition hover:text-slate-950">
                      Pricing
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/">
                    <span className="cursor-pointer text-sm font-semibold text-slate-600 transition hover:text-slate-950">
                      Generator
                    </span>
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:hello@aicontentrepurposer.com"
                    className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black text-slate-950">Legal</h4>
            <nav aria-label="Legal links">
              <ul className="space-y-3">
                <li>
                  <Link href="/privacy-policy">
                    <span className="cursor-pointer text-sm font-semibold text-slate-600 transition hover:text-slate-950">
                      Privacy Policy
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/terms-of-service">
                    <span className="cursor-pointer text-sm font-semibold text-slate-600 transition hover:text-slate-950">
                      Terms of Service
                    </span>
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Content Reworker. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Systems operational
          </p>
        </div>
      </div>
    </footer>
  );
}
