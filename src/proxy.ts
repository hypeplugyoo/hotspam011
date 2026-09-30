import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/register", "/api/auth", "/api/health"];
export function proxy(request: NextRequest) {
  if (publicPaths.some(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))) return NextResponse.next();
  if (!request.cookies.has("pulso_session")) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
