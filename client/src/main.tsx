import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";
import { registerServiceWorker } from "@/lib/pwa";

// تحسين QueryClient للأداء والتخزين المؤقت
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // التخزين المؤقت لمدة 5 دقائق
      staleTime: 5 * 60 * 1000,
      // إعادة المحاولة مرة واحدة فقط
      retry: 1,
      // تأخير إعادة المحاولة
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // عدم إعادة الجلب عند التركيز على النافذة
      refetchOnWindowFocus: false,
      // الاحتفاظ بالبيانات القديمة أثناء التحميل
      placeholderData: (previousData: unknown) => previousData,
      // مهلة الشبكة
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      // تحسين الاتصال
      maxURLLength: 2083,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          // مهلة الاتصال 30 ثانية
          signal: AbortSignal.timeout(30000),
        });
      },
    }),
  ],
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  registerServiceWorker().then((registration) => {
    if (registration) {
      console.log('[PWA] Service Worker registered successfully');
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
