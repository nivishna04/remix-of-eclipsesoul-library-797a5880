import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { EclipseCursor } from "@/components/EclipseCursor";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl neon-text flicker">404</h1>
        <h2 className="mt-4 text-xl font-semibold tracking-widest uppercase text-foreground">
          Signal Lost
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page slipped into the Upside Down.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium uppercase tracking-widest text-primary-foreground neon-glow hover:bg-primary/90"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl neon-text uppercase tracking-widest">System Fault</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm uppercase tracking-widest text-primary-foreground neon-glow"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Eclipsesoul Library — Initializing" },
      { name: "description", content: "Stranger Things inspired library management system." },
      { property: "og:title", content: "Eclipsesoul Library — Initializing" },
      { property: "og:description", content: "Stranger Things inspired library management system." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Eclipsesoul Library — Initializing" },
      { name: "twitter:description", content: "Stranger Things inspired library management system." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/487598ec-cc91-417c-8b52-70a0d0558d41/id-preview-4d98f540--4666dab2-0871-4123-8d96-504a34e05633.lovable.app-1783618151278.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/487598ec-cc91-417c-8b52-70a0d0558d41/id-preview-4d98f540--4666dab2-0871-4123-8d96-504a34e05633.lovable.app-1783618151278.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="scanline" />
      <EclipseCursor />
      <Outlet />
      <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "oklch(0.16 0.018 25)", border: "1px solid oklch(0.62 0.24 25 / 0.4)", color: "oklch(0.96 0.01 25)" } }} />
    </QueryClientProvider>
  );
}
