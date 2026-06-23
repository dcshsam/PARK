"use client";

import { useCallback, useState } from "react";
import {
  type LlmConfig,
  type LlmConnectionStatus,
  type LlmProvider,
  type LlmTestResult,
} from "./types";
import {
  clearLlmConfigOverride,
  getEnvLlmConfig,
  getStoredLlmConfig,
  mergeLlmConfig,
  saveLlmConfigOverride,
} from "./config";

export interface UseLlmConfigResult {
  config: LlmConfig;
  isOverridden: boolean;
  status: LlmConnectionStatus;
  error: string | null;
  testConnection: (candidate?: LlmConfig) => Promise<LlmTestResult>;
  saveOverride: (override: Partial<LlmConfig>) => void;
  resetToDefault: () => void;
}

function getInitialConfig(): LlmConfig {
  if (typeof window === "undefined") return getEnvLlmConfig();
  return mergeLlmConfig(getEnvLlmConfig(), getStoredLlmConfig());
}

function getInitialOverridden(): boolean {
  if (typeof window === "undefined") return false;
  return getStoredLlmConfig() !== null;
}

export function useLlmConfig(): UseLlmConfigResult {
  const [config, setConfig] = useState<LlmConfig>(getInitialConfig);
  const [isOverridden, setIsOverridden] = useState<boolean>(getInitialOverridden);
  const [status, setStatus] = useState<LlmConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const testConnection = useCallback(async (candidate?: LlmConfig): Promise<LlmTestResult> => {
    const target = candidate ?? config;
    setStatus("checking");
    setError(null);

    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });

      const result = (await res.json()) as LlmTestResult;
      setStatus(result.ok ? "connected" : "disconnected");
      if (!result.ok) setError(result.error ?? "Connection failed");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setStatus("disconnected");
      setError(message);
      return { ok: false, provider: target.provider, error: message };
    }
  }, [config]);

  const saveOverride = useCallback((override: Partial<LlmConfig>) => {
    saveLlmConfigOverride(override);
    setConfig(mergeLlmConfig(getEnvLlmConfig(), override));
    setIsOverridden(true);
  }, []);

  const resetToDefault = useCallback(() => {
    clearLlmConfigOverride();
    setConfig(getEnvLlmConfig());
    setIsOverridden(false);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    config,
    isOverridden,
    status,
    error,
    testConnection,
    saveOverride,
    resetToDefault,
  };
}

export function useLlmProvider(): LlmProvider {
  const { config } = useLlmConfig();
  return config.provider;
}
