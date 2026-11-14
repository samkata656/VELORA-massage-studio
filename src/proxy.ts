import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "./i18n/config";

/** Sends visitors without a locale prefix to /bg or /en (cookie, then browser language). */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();

  const cookie = request.cookies.get("velora_locale")?.value;
  const accept = request.headers.get("accept-language") ?? "";
  const locale = isLocale(cookie) ? cookie : /^bg|,\s*bg/i.test(accept) || !/en/i.test(accept) ? defaultLocale : "en";

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API, admin, Next internals and any file with an extension (photos, icons…)
  matcher: ["/((?!api|admin|_next|.*\\..*).*)"],
};
