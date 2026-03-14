import { ThreadId } from "@t3tools/contracts";
import { createFileRoute, retainSearchParams, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, type ReactNode, useCallback, useEffect, useState } from "react";

import {
  ChatSidePanelHeaderSkeleton,
  ChatSidePanelLoadingState,
  ChatSidePanelShell,
  type ChatSidePanelMode,
} from "../ChatSidePanelShell";
import {
  type ChatPanelRouteSearch,
  parseChatPanelRouteSearch,
  stripChatPanelSearchParams,
} from "../chatPanelRouteSearch";
import ChatView from "../components/ChatView";
import { DiffWorkerPoolProvider } from "../components/DiffWorkerPoolProvider";
import { useComposerDraftStore } from "../composerDraftStore";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useStore } from "../store";
import { Sheet, SheetPopup } from "../components/ui/sheet";
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";

const DiffPanel = lazy(() => import("../components/DiffPanel"));
const BrowserPreviewPanel = lazy(() => import("../components/BrowserPreviewPanel"));
const DIFF_INLINE_LAYOUT_MEDIA_QUERY = "(max-width: 1180px)";
const DIFF_INLINE_SIDEBAR_WIDTH_STORAGE_KEY = "chat_diff_sidebar_width";
const DIFF_INLINE_DEFAULT_WIDTH = "clamp(28rem,48vw,44rem)";
const DIFF_INLINE_SIDEBAR_MIN_WIDTH = 26 * 16;
const COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX = 208;

type ActivePanel = "diff" | "preview" | null;

const ChatSidePanelSheet = (props: { children: ReactNode; open: boolean; onClose: () => void }) => {
  return (
    <Sheet
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      <SheetPopup
        side="right"
        showCloseButton={false}
        keepMounted
        className="w-[min(88vw,820px)] max-w-[820px] p-0"
      >
        {props.children}
      </SheetPopup>
    </Sheet>
  );
};

const SidePanelLoadingFallback = (props: { mode: ChatSidePanelMode; label: string }) => {
  return (
    <ChatSidePanelShell mode={props.mode} header={<ChatSidePanelHeaderSkeleton />}>
      <ChatSidePanelLoadingState label={props.label} />
    </ChatSidePanelShell>
  );
};

const LazyDiffPanel = (props: { mode: ChatSidePanelMode }) => {
  return (
    <DiffWorkerPoolProvider>
      <Suspense
        fallback={<SidePanelLoadingFallback mode={props.mode} label="Loading diff viewer..." />}
      >
        <DiffPanel mode={props.mode} />
      </Suspense>
    </DiffWorkerPoolProvider>
  );
};

const LazyBrowserPreviewPanel = (props: { mode: ChatSidePanelMode }) => {
  return (
    <Suspense
      fallback={<SidePanelLoadingFallback mode={props.mode} label="Loading browser preview..." />}
    >
      <BrowserPreviewPanel mode={props.mode} />
    </Suspense>
  );
};

const ChatSidePanelInlineSidebar = (props: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) => {
  const { open, onClose, children } = props;
  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onClose();
      }
    },
    [onClose],
  );
  const shouldAcceptInlineSidebarWidth = useCallback(
    ({ nextWidth, wrapper }: { nextWidth: number; wrapper: HTMLElement }) => {
      const composerForm = document.querySelector<HTMLElement>("[data-chat-composer-form='true']");
      if (!composerForm) return true;
      const composerViewport = composerForm.parentElement;
      if (!composerViewport) return true;
      const previousSidebarWidth = wrapper.style.getPropertyValue("--sidebar-width");
      wrapper.style.setProperty("--sidebar-width", `${nextWidth}px`);

      const viewportStyle = window.getComputedStyle(composerViewport);
      const viewportPaddingLeft = Number.parseFloat(viewportStyle.paddingLeft) || 0;
      const viewportPaddingRight = Number.parseFloat(viewportStyle.paddingRight) || 0;
      const viewportContentWidth = Math.max(
        0,
        composerViewport.clientWidth - viewportPaddingLeft - viewportPaddingRight,
      );
      const formRect = composerForm.getBoundingClientRect();
      const composerFooter = composerForm.querySelector<HTMLElement>(
        "[data-chat-composer-footer='true']",
      );
      const composerRightActions = composerForm.querySelector<HTMLElement>(
        "[data-chat-composer-actions='right']",
      );
      const composerRightActionsWidth = composerRightActions?.getBoundingClientRect().width ?? 0;
      const composerFooterGap = composerFooter
        ? Number.parseFloat(window.getComputedStyle(composerFooter).columnGap) ||
          Number.parseFloat(window.getComputedStyle(composerFooter).gap) ||
          0
        : 0;
      const minimumComposerWidth =
        COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX + composerRightActionsWidth + composerFooterGap;
      const hasComposerOverflow = composerForm.scrollWidth > composerForm.clientWidth + 0.5;
      const overflowsViewport = formRect.width > viewportContentWidth + 0.5;
      const violatesMinimumComposerWidth = composerForm.clientWidth + 0.5 < minimumComposerWidth;

      if (previousSidebarWidth.length > 0) {
        wrapper.style.setProperty("--sidebar-width", previousSidebarWidth);
      } else {
        wrapper.style.removeProperty("--sidebar-width");
      }

      return !hasComposerOverflow && !overflowsViewport && !violatesMinimumComposerWidth;
    },
    [],
  );

  return (
    <SidebarProvider
      defaultOpen={false}
      open={open}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": DIFF_INLINE_DEFAULT_WIDTH } as React.CSSProperties}
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-border bg-card text-foreground"
        resizable={{
          minWidth: DIFF_INLINE_SIDEBAR_MIN_WIDTH,
          shouldAcceptWidth: shouldAcceptInlineSidebarWidth,
          storageKey: DIFF_INLINE_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        {children}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
};

function ChatSidePanelContent(props: {
  activePanel: ActivePanel;
  renderDiffContent: boolean;
  renderPreviewContent: boolean;
  mode: ChatSidePanelMode;
}) {
  return (
    <>
      {props.renderDiffContent ? (
        <div className={cn("h-full min-h-0", props.activePanel === "diff" ? "block" : "hidden")}>
          <LazyDiffPanel mode={props.mode} />
        </div>
      ) : null}
      {props.renderPreviewContent ? (
        <div className={cn("h-full min-h-0", props.activePanel === "preview" ? "block" : "hidden")}>
          <LazyBrowserPreviewPanel mode={props.mode} />
        </div>
      ) : null}
    </>
  );
}

function ChatThreadRouteView() {
  const threadsHydrated = useStore((store) => store.threadsHydrated);
  const navigate = useNavigate();
  const threadId = Route.useParams({
    select: (params) => ThreadId.makeUnsafe(params.threadId),
  });
  const search = Route.useSearch();
  const threadExists = useStore((store) => store.threads.some((thread) => thread.id === threadId));
  const draftThreadExists = useComposerDraftStore((store) =>
    Object.hasOwn(store.draftThreadsByThreadId, threadId),
  );
  const routeThreadExists = threadExists || draftThreadExists;
  const diffOpen = search.diff === "1";
  const previewOpen = search.preview === "1";
  const activePanel: ActivePanel = previewOpen ? "preview" : diffOpen ? "diff" : null;
  const shouldUseDiffSheet = useMediaQuery(DIFF_INLINE_LAYOUT_MEDIA_QUERY);
  const [hasOpenedDiff, setHasOpenedDiff] = useState(diffOpen);
  const [hasOpenedPreview, setHasOpenedPreview] = useState(previewOpen);
  const closeActivePanel = useCallback(() => {
    void navigate({
      to: "/$threadId",
      params: { threadId },
      search: (previous) => ({
        ...stripChatPanelSearchParams(previous),
        diff: undefined,
        diffTurnId: undefined,
        diffFilePath: undefined,
        preview: undefined,
        previewUrl: undefined,
      }),
    });
  }, [navigate, threadId]);

  useEffect(() => {
    if (diffOpen) {
      setHasOpenedDiff(true);
    }
  }, [diffOpen]);

  useEffect(() => {
    if (previewOpen) {
      setHasOpenedPreview(true);
    }
  }, [previewOpen]);

  useEffect(() => {
    if (!threadsHydrated) {
      return;
    }

    if (!routeThreadExists) {
      void navigate({ to: "/", replace: true });
      return;
    }
  }, [navigate, routeThreadExists, threadsHydrated, threadId]);

  if (!threadsHydrated || !routeThreadExists) {
    return null;
  }

  const shouldRenderDiffContent = diffOpen || hasOpenedDiff;
  const shouldRenderPreviewContent = previewOpen || hasOpenedPreview;

  if (!shouldUseDiffSheet) {
    return (
      <>
        <SidebarInset className="h-dvh  min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
          <ChatView key={threadId} threadId={threadId} />
        </SidebarInset>
        <ChatSidePanelInlineSidebar open={activePanel !== null} onClose={closeActivePanel}>
          <ChatSidePanelContent
            activePanel={activePanel}
            renderDiffContent={shouldRenderDiffContent}
            renderPreviewContent={shouldRenderPreviewContent}
            mode="sidebar"
          />
        </ChatSidePanelInlineSidebar>
      </>
    );
  }

  return (
    <>
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView key={threadId} threadId={threadId} />
      </SidebarInset>
      <ChatSidePanelSheet open={activePanel !== null} onClose={closeActivePanel}>
        <ChatSidePanelContent
          activePanel={activePanel}
          renderDiffContent={shouldRenderDiffContent}
          renderPreviewContent={shouldRenderPreviewContent}
          mode="sheet"
        />
      </ChatSidePanelSheet>
    </>
  );
}

export const Route = createFileRoute("/_chat/$threadId")({
  validateSearch: (search) => parseChatPanelRouteSearch(search),
  search: {
    middlewares: [
      retainSearchParams<ChatPanelRouteSearch>([
        "diff",
        "diffTurnId",
        "diffFilePath",
        "preview",
        "previewUrl",
      ]),
    ],
  },
  component: ChatThreadRouteView,
});
