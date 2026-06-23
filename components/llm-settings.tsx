"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLlmConfig } from "@/lib/llm/use-llm-config";
import { getEnvLlmConfig } from "@/lib/llm/config";
import { type LlmConfig, type LlmProvider, providerLabels } from "@/lib/llm/types";
import { Bot, Check, RefreshCcw, RotateCcw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const providers: LlmProvider[] = ["claude", "kimi", "sap-ai-core"];

export function LlmSettings() {
  const { config, isOverridden, status, testConnection, saveOverride, resetToDefault } =
    useLlmConfig();

  const [draft, setDraft] = useState<LlmConfig>(config);
  const [override, setOverride] = useState(isOverridden);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const updateProvider = (provider: LlmProvider) => {
    setDraft((prev) => ({ ...prev, provider }));
  };

  const updateClaude = (changes: Partial<LlmConfig["claude"]>) => {
    setDraft((prev) => ({ ...prev, claude: { ...prev.claude, ...changes } }));
  };

  const updateKimi = (changes: Partial<LlmConfig["kimi"]>) => {
    setDraft((prev) => ({ ...prev, kimi: { ...prev.kimi, ...changes } }));
  };

  const updateSapAiCore = (changes: Partial<LlmConfig["sapAiCore"]>) => {
    setDraft((prev) => ({ ...prev, sapAiCore: { ...prev.sapAiCore, ...changes } }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMessage(null);
    const result = await testConnection(draft);
    setTesting(false);
    setTestMessage(result.ok ? "Connected successfully." : result.error ?? "Connection failed.");
  };

  const handleSave = () => {
    saveOverride(draft);
    setTestMessage("Settings saved.");
  };

  const handleReset = () => {
    resetToDefault();
    setDraft(getEnvLlmConfig());
    setOverride(false);
    setTestMessage(null);
  };

  const toggleOverride = (checked: boolean) => {
    setOverride(checked);
    if (!checked) {
      resetToDefault();
      setDraft(getEnvLlmConfig());
      setTestMessage(null);
    }
  };

  const disabled = !override;
  const testSuccess = status === "connected" || testMessage === "Settings saved.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot size={20} className="text-primary-600" /> LLM Provider
        </CardTitle>
        <CardDescription>
          Choose the default language model and configure credentials. Values from{" "}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-xs text-text-secondary">.env.local</code>{" "}
          are shown as read-only until you enable override.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/50 p-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Override environment defaults</p>
            <p className="text-xs text-text-tertiary">
              Enable to edit credentials and provider below.
            </p>
          </div>
          <Switch checked={override} onCheckedChange={toggleOverride} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="llm-provider">Provider</Label>
          <Select
            id="llm-provider"
            value={draft.provider}
            onChange={(e) => updateProvider(e.target.value as LlmProvider)}
            disabled={disabled}
          >
            {providers.map((p) => (
              <option key={p} value={p}>
                {providerLabels[p]}
              </option>
            ))}
          </Select>
        </div>

        {draft.provider === "claude" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claude-api-key">Anthropic API Key</Label>
              <Input
                id="claude-api-key"
                type="password"
                value={draft.claude.apiKey}
                onChange={(e) => updateClaude({ apiKey: e.target.value })}
                disabled={disabled}
                placeholder="sk-ant-api03-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claude-model">Model</Label>
              <Input
                id="claude-model"
                value={draft.claude.model}
                onChange={(e) => updateClaude({ model: e.target.value })}
                disabled={disabled}
                placeholder="claude-3-5-sonnet-20241022"
              />
            </div>
          </div>
        )}

        {draft.provider === "kimi" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kimi-api-key">Kimi API Key</Label>
              <Input
                id="kimi-api-key"
                type="password"
                value={draft.kimi.apiKey}
                onChange={(e) => updateKimi({ apiKey: e.target.value })}
                disabled={disabled}
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kimi-model">Model</Label>
              <Input
                id="kimi-model"
                value={draft.kimi.model}
                onChange={(e) => updateKimi({ model: e.target.value })}
                disabled={disabled}
                placeholder="moonshot-v1-8k"
              />
            </div>
          </div>
        )}

        {draft.provider === "sap-ai-core" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sap-auth-url">OAuth Token URL</Label>
              <Input
                id="sap-auth-url"
                value={draft.sapAiCore.authUrl}
                onChange={(e) => updateSapAiCore({ authUrl: e.target.value })}
                disabled={disabled}
                placeholder="https://...authentication.../oauth/token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sap-client-id">Client ID</Label>
              <Input
                id="sap-client-id"
                value={draft.sapAiCore.clientId}
                onChange={(e) => updateSapAiCore({ clientId: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sap-client-secret">Client Secret</Label>
              <Input
                id="sap-client-secret"
                type="password"
                value={draft.sapAiCore.clientSecret}
                onChange={(e) => updateSapAiCore({ clientSecret: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sap-base-url">AI Core Base URL</Label>
              <Input
                id="sap-base-url"
                value={draft.sapAiCore.baseUrl}
                onChange={(e) => updateSapAiCore({ baseUrl: e.target.value })}
                disabled={disabled}
                placeholder="https://api.ai.prod..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sap-resource-group">Resource Group</Label>
              <Input
                id="sap-resource-group"
                value={draft.sapAiCore.resourceGroup}
                onChange={(e) => updateSapAiCore({ resourceGroup: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sap-deployment-id">Deployment ID</Label>
              <Input
                id="sap-deployment-id"
                value={draft.sapAiCore.deploymentId}
                onChange={(e) => updateSapAiCore({ deploymentId: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sap-model">Model (optional)</Label>
              <Input
                id="sap-model"
                value={draft.sapAiCore.model}
                onChange={(e) => updateSapAiCore({ model: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {testMessage && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl p-3 text-sm",
              testSuccess
                ? "bg-status-success-bg text-status-success-text"
                : "bg-status-danger-bg text-status-danger-text"
            )}
          >
            {testSuccess ? (
              <Check size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            )}
            {testMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleTest} disabled={testing || disabled} variant="secondary">
            {testing ? (
              <RefreshCcw size={16} className="mr-2 animate-spin" />
            ) : (
              <Check size={16} className="mr-2" />
            )}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={disabled}>
            Save Override
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw size={16} className="mr-2" />
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
