import { TurnId } from "@t3tools/contracts";

export interface ChatPanelRouteSearch {
  diff?: "1" | undefined;
  diffTurnId?: TurnId | undefined;
  diffFilePath?: string | undefined;
  preview?: "1" | undefined;
  previewUrl?: string | undefined;
}

function isPanelOpenValue(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

function normalizeSearchString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizePreviewUrl(value: unknown): string | undefined {
  const normalized = normalizeSearchString(value);
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.href;
  } catch {
    return undefined;
  }
}

export function stripDiffSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "diff" | "diffTurnId" | "diffFilePath"> {
  const { diff: _diff, diffTurnId: _diffTurnId, diffFilePath: _diffFilePath, ...rest } = params;
  return rest as Omit<T, "diff" | "diffTurnId" | "diffFilePath">;
}

export function stripPreviewSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "preview" | "previewUrl"> {
  const { preview: _preview, previewUrl: _previewUrl, ...rest } = params;
  return rest as Omit<T, "preview" | "previewUrl">;
}

export function stripChatPanelSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "diff" | "diffTurnId" | "diffFilePath" | "preview" | "previewUrl"> {
  return stripPreviewSearchParams(stripDiffSearchParams(params)) as Omit<
    T,
    "diff" | "diffTurnId" | "diffFilePath" | "preview" | "previewUrl"
  >;
}

export function parseChatPanelRouteSearch(search: Record<string, unknown>): ChatPanelRouteSearch {
  const preview = isPanelOpenValue(search.preview) ? "1" : undefined;
  const diff = preview ? undefined : isPanelOpenValue(search.diff) ? "1" : undefined;

  const previewUrl = preview ? normalizePreviewUrl(search.previewUrl) : undefined;
  const diffTurnIdRaw = diff ? normalizeSearchString(search.diffTurnId) : undefined;
  const diffTurnId = diffTurnIdRaw ? TurnId.makeUnsafe(diffTurnIdRaw) : undefined;
  const diffFilePath = diff && diffTurnId ? normalizeSearchString(search.diffFilePath) : undefined;

  return {
    ...(diff ? { diff } : {}),
    ...(diffTurnId ? { diffTurnId } : {}),
    ...(diffFilePath ? { diffFilePath } : {}),
    ...(preview ? { preview } : {}),
    ...(previewUrl ? { previewUrl } : {}),
  };
}
