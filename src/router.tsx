import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cache padrão: dados considerados frescos por 1 min, mantidos em memória por 5 min.
        // Rotas com necessidade diferente sobrescrevem via queryOptions.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  // Devlog opcional de HIT/MISS de cache (apenas em desenvolvimento).
  if (import.meta.env.DEV && typeof window !== "undefined") {
    queryClient.getQueryCache().subscribe((evt) => {
      if (evt.type === "updated" && evt.action.type === "fetch") {
        // eslint-disable-next-line no-console
        console.debug("[CACHE MISS]", evt.query.queryKey);
      }
    });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
