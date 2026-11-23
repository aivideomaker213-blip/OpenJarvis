import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MessageBubble } from './MessageBubble';
import { InputArea } from './InputArea';
import { StreamingDots } from './StreamingDots';
import { useAppStore } from '../../lib/store';
import { shouldAutoplayFinishedReply, useTtsStore } from '../../lib/tts';
import { stripThinkTags } from '../../lib/message-text';
import {
  PanelRightOpen,
  PanelRightClose,
  Database,
  MessageSquare,
  X,
} from 'lucide-react';
import { listConnectors } from '../../lib/connectors-api';

const SATHI_LOGO_PATH = '/sathi-ai-logo.png';

export function ChatArea() {
  const activeId = useAppStore((s) => s.activeId);
  const messages = useAppStore((s) => s.messages);
  const streamState = useAppStore((s) => s.streamState);
  const systemPanelOpen = useAppStore((s) => s.systemPanelOpen);
  const toggleSystemPanel = useAppStore((s) => s.toggleSystemPanel);

  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const wasStreaming = useRef(false);
  const lastScrollTop = useRef(0);

  const isCurrentChatStreaming =
    streamState.isStreaming && streamState.conversationId === activeId;

  const voiceOutputEnabled = useAppStore(
    (s) => s.settings.voiceOutputEnabled
  );
  const voiceAutoplay = useAppStore(
    (s) => s.settings.voiceAutoplay
  );

  useEffect(() => {
    if (!voiceOutputEnabled) return;
    useTtsStore.getState().ensureHealth();
  }, [voiceOutputEnabled]);

  const streamingConversationRef = useRef<string | null>(null);

  useEffect(() => {
    const last = messages[messages.length - 1];
    const tts = useTtsStore.getState();

    const justFinished = shouldAutoplayFinishedReply(
      streamingConversationRef.current,
      activeId,
      streamState.isStreaming,
      last,
      tts.autoSpokenId
    );

    streamingConversationRef.current = isCurrentChatStreaming
      ? activeId
      : null;

    if (!justFinished) return;
    if (!voiceOutputEnabled || !voiceAutoplay) return;
    if (!last || last.role !== 'assistant' || activeId === null) return;

    const completedConversationId = activeId;
    const completedMessageId = last.id;

    void tts.ensureHealth().then(() => {
      const app = useAppStore.getState();
      const currentTts = useTtsStore.getState();
      const currentLast = app.messages[app.messages.length - 1];

      if (app.activeId !== completedConversationId || app.streamState.isStreaming) return;
      if (!app.settings.voiceOutputEnabled || !app.settings.voiceAutoplay) return;
      if (currentLast?.id !== completedMessageId || currentTts.available !== true) return;
      if (currentTts.autoSpokenId === completedMessageId) return;

      const text = stripThinkTags(currentLast.content);
      if (!text) return;

      currentTts.markAutoSpoken(completedMessageId);
      void currentTts.speak(completedMessageId, text);
    });
  }, [
    activeId,
    messages,
    streamState.isStreaming,
    isCurrentChatStreaming,
    voiceOutputEnabled,
    voiceAutoplay,
  ]);

  const currentStreamContent = isCurrentChatStreaming
    ? streamState.content
    : '';

  const [hasConnectedSources, setHasConnectedSources] =
    useState<boolean | null>(null);

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  useEffect(() => {
    listConnectors()
      .then((list) =>
        setHasConnectedSources(list.some((c) => c.connected))
      )
      .catch(() => setHasConnectedSources(null));
  }, []);

  useEffect(() => {
    if (isCurrentChatStreaming && !wasStreaming.current) {
      shouldAutoScroll.current = true;
    }

    wasStreaming.current = isCurrentChatStreaming;

    if (shouldAutoScroll.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, currentStreamContent, isCurrentChatStreaming]);

  const handleScroll = () => {
    if (!listRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const distance = scrollHeight - scrollTop - clientHeight;
    const scrolledUp = scrollTop < lastScrollTop.current;

    lastScrollTop.current = scrollTop;

    if (scrolledUp && distance >= 1) {
      shouldAutoScroll.current = false;
    } else if (!scrolledUp) {
      shouldAutoScroll.current = distance < 2;
    }
  };

  const isEmpty = messages.length === 0 && !isCurrentChatStreaming;

  const PanelIcon = systemPanelOpen
    ? PanelRightClose
    : PanelRightOpen;

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text)',
      }}
    >
      {/* SATHI AI top controls */}
      <div
        className="flex items-center justify-end px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,65,45,0.12)' }}
      >
        <button
          onClick={toggleSystemPanel}
          className="p-2 rounded-lg cursor-pointer transition-colors"
          style={{
            color: '#ff493b',
            background: 'rgba(255,65,45,0.07)',
            border: '1px solid rgba(255,65,45,0.2)',
          }}
          title="Toggle system panel"
        >
          <PanelIcon size={18} />
        </button>
      </div>

      {/* Data sources banner */}
      {hasConnectedSources === false && !bannerDismissed && (
        <div
          className="mx-4 mb-2 flex items-center gap-3 px-4 py-3 rounded-lg text-sm shrink-0"
          style={{
            background: 'rgba(255,65,45,0.07)',
            border: '1px solid rgba(255,65,45,0.3)',
          }}
        >
          <Database size={17} style={{ color: '#ff493b' }} />

          <span style={{ color: 'var(--color-text-secondary)', flex: 1 }}>
            Connect your data sources to give SATHI more context.
          </span>

          <button
            onClick={() => navigate('/data-sources')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{
              background: '#e93627',
              color: '#ffffff',
              border: 'none',
            }}
          >
            Connect
          </button>

          <button
            onClick={() => setBannerDismissed(true)}
            className="p-1 rounded cursor-pointer"
            style={{
              color: 'var(--color-text-tertiary)',
              background: 'transparent',
              border: 'none',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Chat messages */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8">

            {/* SATHI AI red emblem */}
            <div
              className="relative flex items-center justify-center mb-7"
              style={{ width: 150, height: 150 }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '2px solid rgba(255,65,45,0.25)',
                  boxShadow: '0 0 35px rgba(255,45,25,0.16)',
                }}
              />

              <div
                className="absolute rounded-full"
                style={{
                  inset: 10,
                  border: '3px dashed rgba(255,65,45,0.65)',
                }}
              />

              <div
                className="absolute rounded-full"
                style={{
                  inset: 23,
                  border: '2px solid #ff493b',
                  boxShadow: '0 0 20px rgba(255,65,45,0.35)',
                }}
              />

              <div
                className="relative flex items-center justify-center rounded-full overflow-hidden"
                style={{
                  width: 90,
                  height: 90,
                  background: 'radial-gradient(circle, #ff765d 0%, #bd170d 65%, #310600 100%)',
                  border: '3px solid #ff5946',
                  boxShadow: '0 0 25px rgba(255,45,25,0.65)',
                }}
              >
                {!logoLoadFailed ? (
                  <img
                    src={SATHI_LOGO_PATH}
                    alt="SATHI AI Logo"
                    onError={() => setLogoLoadFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 65,
                      fontWeight: 900,
                      fontStyle: 'italic',
                      color: '#ffffff',
                      textShadow: '0 0 15px #ff493b',
                      lineHeight: 1,
                    }}
                  >
                    S
                  </span>
                )}
              </div>

              <div
                className="absolute rounded-full"
                style={{
                  width: 7,
                  height: 7,
                  top: 5,
                  background: '#ff493b',
                  boxShadow: '0 0 12px #ff493b',
                }}
              />
            </div>

            {/* Brand name */}
            <h1
              className="text-3xl font-bold tracking-widest mb-2"
              style={{
                color: '#ff493b',
                textShadow: '0 0 15px rgba(255,65,45,0.35)',
              }}
            >
              SATHI AI
            </h1>

            <p
              className="text-xs font-semibold tracking-[0.3em] mb-7"
              style={{ color: '#ff806e' }}
            >
              SMARTER. FASTER. TOGETHER.
            </p>

            <h2
              className="text-xl font-semibold mb-2 text-center"
              style={{ color: 'var(--color-text)' }}
            >
              नमस्कार! म साथी हुँ।
            </h2>

            <p
              className="text-sm text-center max-w-sm mb-8"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              तपाईंलाई आज म के सहयोग गर्न सक्छु?
              मलाई नेपाली वा अंग्रेजीमा सोध्नुहोस्।
            </p>

            {/* Quick action hints */}
            <div className="flex flex-wrap justify-center gap-3">

              <button
                onClick={() => navigate('/data-sources')}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs cursor-pointer transition-colors"
                style={{
                  background: 'rgba(255,65,45,0.07)',
                  border: '1px solid rgba(255,65,45,0.3)',
                  color: 'var(--color-text)',
                }}
              >
                <Database size={16} style={{ color: '#ff493b' }} />
                Connect Data Sources
              </button>

              <button
                onClick={() => {
                  navigate('/data-sources');
                  window.dispatchEvent(
                    new CustomEvent('switch-tab', {
                      detail: 'messaging',
                    })
                  );
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs cursor-pointer transition-colors"
                style={{
                  background: 'rgba(255,65,45,0.07)',
                  border: '1px solid rgba(255,65,45,0.3)',
                  color: 'var(--color-text)',
                }}
              >
                <MessageSquare size={16} style={{ color: '#ff493b' }} />
                Messaging Channels
              </button>

            </div>
          </div>
        ) : (
          <div className="max-w-[var(--chat-max-width)] mx-auto px-4 py-6">
            {messages.map((msg, i) => {
              const isLastAssistant =
                i === messages.length - 1 && msg.role === 'assistant';

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isLive={isLastAssistant && isCurrentChatStreaming}
                />
              );
            })}

            {(() => {
              if (!isCurrentChatStreaming || streamState.content !== '') {
                return null;
              }

              const last = messages[messages.length - 1];

              if (last?.role === 'assistant' && last.isResearch) {
                return null;
              }

              return (
                <div className="flex justify-start mb-4">
                  <StreamingDots phase={streamState.phase} />
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Message input */}
      <InputArea />
    </div>
  );
}
