import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and keeps cookies in
 * sync. Role-based route guards (admin/player/jury) will be layered on top.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // If Supabase env vars aren't configured yet (e.g. a preview deploy made
  // before wiring), skip the refresh instead of crashing the request.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token; do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected =
    path === "/account" ||
    path.startsWith("/account/") ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/archive" ||
    path.startsWith("/archive/") ||
    path.startsWith("/vote/");
  const isAuthPage = path === "/login" || path === "/signup";

  // Unauthenticated users may not see protected areas — bounce to login and
  // remember where they were headed (login/signup honour ?next=).
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  // Signed-in users skip the auth pages.
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/account";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}

/** Carry the refreshed session cookies onto a redirect response. */
function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}
