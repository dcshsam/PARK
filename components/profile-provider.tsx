"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getProfiles, seedDefaultProfiles } from "@/lib/db";
import {
  type Action,
  type Profile,
  type Role,
  getActiveProfileId,
  roleCan,
  setActiveProfileId,
} from "@/lib/profiles/types";

interface ProfileContextValue {
  ready: boolean;
  profiles: Profile[];
  currentProfile: Profile | null;
  role: Role | undefined;
  can: (action: Action) => boolean;
  setActiveProfile: (id: string) => void;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await seedDefaultProfiles();
      const list = await getProfiles();
      if (cancelled) return;
      setProfiles(list);

      let id = getActiveProfileId();
      if (!id || !list.some((p) => p.id === id)) {
        // Default to the first admin, else the first profile.
        id = (list.find((p) => p.role === "admin") ?? list[0])?.id ?? null;
        if (id) setActiveProfileId(id);
      }
      setCurrentId(id);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setActiveProfile = useCallback((id: string) => {
    setActiveProfileId(id);
    setCurrentId(id);
  }, []);

  const refresh = useCallback(async () => {
    const list = await getProfiles();
    setProfiles(list);
    // If the active profile was deleted, fall back to an admin.
    setCurrentId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      const fallback = (list.find((p) => p.role === "admin") ?? list[0])?.id ?? null;
      if (fallback) setActiveProfileId(fallback);
      return fallback;
    });
  }, []);

  const currentProfile = profiles.find((p) => p.id === currentId) ?? null;
  const role = currentProfile?.role;

  const can = useCallback(
    (action: Action) => {
      // Before profiles load, allow only read access to avoid flashing controls.
      if (!ready) return action === "view";
      return roleCan(role, action);
    },
    [ready, role]
  );

  return (
    <ProfileContext.Provider
      value={{ ready, profiles, currentProfile, role, can, setActiveProfile, refresh }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
