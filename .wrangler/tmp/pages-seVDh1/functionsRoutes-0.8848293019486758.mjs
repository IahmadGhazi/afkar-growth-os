import { onRequest as __api_admin_users_ts_onRequest } from "E:\\Afkar\\afkar-growth-os\\functions\\api\\admin\\users.ts"
import { onRequest as __api_integrations_status_ts_onRequest } from "E:\\Afkar\\afkar-growth-os\\functions\\api\\integrations\\status.ts"
import { onRequest as __api_integrations_sync_ts_onRequest } from "E:\\Afkar\\afkar-growth-os\\functions\\api\\integrations\\sync.ts"

export const routes = [
    {
      routePath: "/api/admin/users",
      mountPath: "/api/admin",
      method: "",
      middlewares: [],
      modules: [__api_admin_users_ts_onRequest],
    },
  {
      routePath: "/api/integrations/status",
      mountPath: "/api/integrations",
      method: "",
      middlewares: [],
      modules: [__api_integrations_status_ts_onRequest],
    },
  {
      routePath: "/api/integrations/sync",
      mountPath: "/api/integrations",
      method: "",
      middlewares: [],
      modules: [__api_integrations_sync_ts_onRequest],
    },
  ]