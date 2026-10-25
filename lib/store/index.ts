import type { Store } from "./types";
import { memoryStore } from "./memory";
import { createSupabaseStore } from "./supabase";

let store: Store | null = null;

/** Supabase, wenn konfiguriert; sonst Demo-Speicher mit Beispieldaten. */
export function getStore(): Store {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = url && key ? createSupabaseStore(url, key) : memoryStore;
  return store;
}

export type { Store };
