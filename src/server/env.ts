export interface AppBindings {
  DB: D1Database;
  MAL_CLIENT_ID: string;
  ADMIN_SYNC_TOKEN: string;
}

export type AppEnv = { Bindings: AppBindings };
