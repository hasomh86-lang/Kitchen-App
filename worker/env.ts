import type { SessionUser } from '@shared/types';

export interface Env {
  DB: D1Database;
  IMAGES: KVNamespace;
  ASSETS: Fetcher;
  APP_NAME: string;
  SESSION_SECRET?: string;
  GEMINI_API_KEY?: string;
}

export type Vars = {
  user: SessionUser | null;
  sessionId: string | null;
};

export type AppContext = { Bindings: Env; Variables: Vars };
