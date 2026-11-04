import { cleanupRuntimeFile, isProcessAlive, readRuntimeInfo } from "../../control/runtime-manager.js";
import type {
  ControlHealthResponse,
  ControlScenariosResponse,
  RequestFilterParams,
  RuntimeInfo,
} from "../../control/types.js";
import type { RequestRecord } from "../../inspector/types.js";
import type { ScenarioMetadata } from "../../scenarios/types.js";

export class ControlClient {
  private runtimeInfo: RuntimeInfo | null = null;
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Resolves the active runtime info, ensuring the process is alive.
   */
  async ensureConnected(): Promise<RuntimeInfo> {
    if (this.runtimeInfo) {
      return this.runtimeInfo;
    }

    const info = readRuntimeInfo(this.cwd);
    if (!info) {
      throw new Error(
        "No running Wiremint development server found in the current directory.\nStart one first using: wiremint dev",
      );
    }

    if (!isProcessAlive(info.pid)) {
      cleanupRuntimeFile(this.cwd);
      throw new Error(
        `Found stale Wiremint runtime record for PID ${info.pid}, but the process is no longer running.\nCleaned up stale runtime file. Start a new server using: wiremint dev`,
      );
    }

    this.runtimeInfo = info;
    return info;
  }

  /**
   * Sends an authenticated request to the local control plane.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const info = await this.ensureConnected();
    const url = `http://${info.controlHost}:${info.controlPort}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${info.token}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };

    let res: Response;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (err) {
      throw new Error(
        `Failed to communicate with Wiremint control plane on port ${info.controlPort}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const body = (await res.json()) as { error?: string } & T;
    if (!res.ok) {
      throw new Error(body.error ?? `Control plane request failed with status ${res.status}`);
    }

    return body;
  }

  async getHealth(): Promise<ControlHealthResponse> {
    return this.request<ControlHealthResponse>("/health");
  }

  async getRoutes(): Promise<{ routes: { method: string; path: string }[] }> {
    return this.request<{ routes: { method: string; path: string }[] }>("/routes");
  }

  async getRequests(
    filters: RequestFilterParams = {},
  ): Promise<{ total: number; requests: RequestRecord[] }> {
    const params = new URLSearchParams();
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.method) params.set("method", filters.method);
    if (filters.path) params.set("path", filters.path);
    if (filters.status) params.set("status", String(filters.status));
    if (filters.scenario) params.set("scenario", filters.scenario);

    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ total: number; requests: RequestRecord[] }>(`/requests${qs}`);
  }

  async getRequest(id: string): Promise<{ request: RequestRecord }> {
    return this.request<{ request: RequestRecord }>(`/requests/${encodeURIComponent(id)}`);
  }

  async getScenarios(): Promise<ControlScenariosResponse> {
    return this.request<ControlScenariosResponse>("/scenarios");
  }

  async setActiveScenario(
    scenarioId: string,
  ): Promise<{ success: boolean; active: ScenarioMetadata }> {
    return this.request<{ success: boolean; active: ScenarioMetadata }>("/scenarios/active", {
      method: "POST",
      body: JSON.stringify({ scenarioId }),
    });
  }

  async resetScenario(scenarioId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/scenarios/${encodeURIComponent(scenarioId)}/reset`,
      { method: "POST" },
    );
  }
}
