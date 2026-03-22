export { auth as middleware } from "./auth";

export const config = {
  matcher: [
    // Protect everything except static files, _next, api/auth
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)",
  ],
};
