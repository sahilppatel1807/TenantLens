import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv, supabaseAuthStorageKey } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabasePublicEnv();
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const authCookieName = supabaseAuthStorageKey(url);
  const supabase = createServerClient(url, anonKey, {
    ...(authCookieName ? { cookieOptions: { name: authCookieName } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && path.startsWith("/dashboard")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (path === "/login" || path === "/register")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.searchParams.delete("next");
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
