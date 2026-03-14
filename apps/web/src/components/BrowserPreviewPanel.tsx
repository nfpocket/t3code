import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ThreadId } from "@t3tools/contracts";
import { GlobeIcon, RefreshCwIcon } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  normalizePreviewUrl,
  parseChatPanelRouteSearch,
  stripChatPanelSearchParams,
} from "../chatPanelRouteSearch";
import { ChatSidePanelShell, type ChatSidePanelMode } from "../ChatSidePanelShell";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface BrowserPreviewPanelProps {
  mode?: ChatSidePanelMode;
}

const PREVIEW_IFRAME_SANDBOX =
  "allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts";

export default function BrowserPreviewPanel({ mode = "inline" }: BrowserPreviewPanelProps) {
  const navigate = useNavigate();
  const threadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });
  const panelSearch = useSearch({
    strict: false,
    select: (search) => parseChatPanelRouteSearch(search),
  });
  const committedPreviewUrl = panelSearch.preview === "1" ? (panelSearch.previewUrl ?? null) : null;
  const [draftUrl, setDraftUrl] = useState(committedPreviewUrl ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(Boolean(committedPreviewUrl));

  useEffect(() => {
    setDraftUrl(committedPreviewUrl ?? "");
    setValidationError(null);
  }, [committedPreviewUrl]);

  useEffect(() => {
    setIframeLoading(Boolean(committedPreviewUrl));
  }, [committedPreviewUrl, reloadVersion]);

  const loadPreview = useCallback(() => {
    if (!threadId) {
      return;
    }

    const nextPreviewUrl = normalizePreviewUrl(draftUrl);
    if (!nextPreviewUrl) {
      setValidationError("Enter an absolute http:// or https:// URL.");
      return;
    }

    setValidationError(null);
    setIframeLoading(true);
    void navigate({
      to: "/$threadId",
      params: { threadId },
      replace: true,
      search: (previous) => ({
        ...stripChatPanelSearchParams(previous),
        diff: undefined,
        diffTurnId: undefined,
        diffFilePath: undefined,
        preview: "1",
        previewUrl: nextPreviewUrl,
      }),
    });
  }, [draftUrl, navigate, threadId]);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      loadPreview();
    },
    [loadPreview],
  );

  const reloadPreview = useCallback(() => {
    if (!committedPreviewUrl) {
      return;
    }
    setIframeLoading(true);
    setReloadVersion((current) => current + 1);
  }, [committedPreviewUrl]);

  const iframeKey = useMemo(
    () => (committedPreviewUrl ? `${committedPreviewUrl}:${reloadVersion}` : "empty"),
    [committedPreviewUrl, reloadVersion],
  );

  const header = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2 [-webkit-app-region:no-drag]">
        <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">Browser Preview</div>
          <div className="truncate text-[11px] text-muted-foreground">
            Manual URL preview for embeddable http(s) pages
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 [-webkit-app-region:no-drag]">
        <Button
          variant="outline"
          size="xs"
          onClick={reloadPreview}
          disabled={!committedPreviewUrl}
          aria-label="Reload browser preview"
        >
          <RefreshCwIcon className="size-3.5" />
          Reload
        </Button>
      </div>
    </>
  );

  return (
    <ChatSidePanelShell mode={mode} header={header}>
      <div className="flex min-h-0 flex-1 flex-col" data-browser-preview-panel="true">
        <form
          className="border-b border-border px-3 py-3"
          onSubmit={onSubmit}
          data-browser-preview-form="true"
        >
          <div className="flex items-center gap-2">
            <Input
              aria-label="Browser preview URL"
              placeholder="https://example.com"
              value={draftUrl}
              onChange={(event) => {
                setDraftUrl(event.currentTarget.value);
                if (validationError) {
                  setValidationError(null);
                }
              }}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              nativeInput
            />
            <Button size="xs" type="submit">
              Load
            </Button>
          </div>
          <div className="mt-2 space-y-1">
            {validationError ? (
              <p className="text-[11px] text-destructive">{validationError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Only absolute <code>http://</code> and <code>https://</code> URLs are supported.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/80">
              Some sites may refuse to load inside an embedded preview.
            </p>
          </div>
        </form>
        {!committedPreviewUrl ? (
          <div
            className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70"
            data-browser-preview-empty="true"
          >
            Enter a URL above to load a browser preview.
          </div>
        ) : (
          <div className="relative min-h-0 flex-1 bg-card/25">
            {iframeLoading ? (
              <div
                className="absolute inset-x-3 top-3 z-10 rounded-md border border-border/60 bg-background/90 px-3 py-2 text-[11px] text-muted-foreground shadow-sm"
                role="status"
                aria-live="polite"
              >
                Loading preview...
              </div>
            ) : null}
            <iframe
              key={iframeKey}
              title="Browser preview"
              src={committedPreviewUrl}
              sandbox={PREVIEW_IFRAME_SANDBOX}
              className={cn("h-full w-full border-0 bg-background", iframeLoading && "opacity-80")}
              onLoad={() => {
                setIframeLoading(false);
              }}
              data-browser-preview-frame="true"
            />
          </div>
        )}
      </div>
    </ChatSidePanelShell>
  );
}
