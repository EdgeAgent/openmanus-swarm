import { useState, useRef, useEffect, useCallback } from 'react';
import type { Agent, ChatMessage } from '../types';
import { useChat } from '../hooks/useChat';

interface ChatInterfaceProps {
  agents: Agent[];
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2 px-4">
      <span className="w-1.5 h-1.5 rounded-full bg-edge-cyan animate-pulse" />
      <span className="w-1.5 h-1.5 rounded-full bg-edge-cyan animate-pulse" style={{ animationDelay: '0.15s' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-edge-cyan animate-pulse" style={{ animationDelay: '0.3s' }} />
      <span className="font-mono text-[10px] text-edge-secondary ml-1">typing...</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    idle: '#34d399',
    busy: '#fbbf24',
    error: '#ff4d4d',
    offline: '#6e6e80',
  };
  const color = colorMap[status] || '#6e6e80';
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}80`,
      }}
    />
  );
}

export default function ChatInterface({ agents }: ChatInterfaceProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const { messages, loading, sendMessage, loadHistory, clearHistory } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  // Load history when agent changes
  useEffect(() => {
    if (selectedAgentId) {
      loadHistory(selectedAgentId);
    }
  }, [selectedAgentId, loadHistory]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !selectedAgentId || loading) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(selectedAgentId, text);
  }, [inputText, selectedAgentId, loading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (selectedAgentId) {
      clearHistory(selectedAgentId);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] edge-card overflow-hidden animate-fade-in">
      {/* Agent Selector Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-edge-border bg-edge-bg/50 flex flex-col">
        <div className="px-4 py-4 border-b border-edge-border">
          <h3 className="font-mono text-xs font-bold text-edge-primary tracking-wide">
            AGENTS
          </h3>
          <p className="font-mono text-[10px] text-edge-secondary mt-1">
            {agents.length} AVAILABLE
          </p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                selectedAgentId === agent.id
                  ? 'bg-edge-border/60 border-l-2'
                  : 'hover:bg-edge-border/30 border-l-2 border-transparent'
              }`}
              style={
                selectedAgentId === agent.id
                  ? { borderLeftColor: agent.accent_color }
                  : undefined
              }
            >
              <StatusDot status={agent.status} />
              <div className="min-w-0">
                <p
                  className="font-mono text-xs font-semibold truncate"
                  style={{ color: agent.accent_color }}
                >
                  {agent.name}
                </p>
                <p className="font-mono text-[10px] text-edge-secondary truncate">
                  {agent.role}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedAgent ? (
          <>
            {/* Agent Info Bar */}
            <div className="h-14 flex-shrink-0 border-b border-edge-border flex items-center justify-between px-5 bg-edge-bg/30">
              <div className="flex items-center gap-3">
                <StatusDot status={selectedAgent.status} />
                <div>
                  <p
                    className="font-mono text-xs font-bold"
                    style={{ color: selectedAgent.accent_color }}
                  >
                    {selectedAgent.name}
                  </p>
                  <p className="font-mono text-[10px] text-edge-secondary">
                    {selectedAgent.model}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClear}
                  className="font-mono text-[10px] text-edge-secondary hover:text-edge-error transition-colors px-3 py-1.5 rounded border border-edge-border hover:border-edge-error/40"
                >
                  CLEAR
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && !loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="font-mono text-xs text-edge-secondary">
                      No messages yet
                    </p>
                    <p className="font-mono text-[10px] text-edge-secondary/50 mt-1">
                      Send a message to start the conversation
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg: ChatMessage) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      msg.role === 'user'
                        ? 'border-l-2 border-l-edge-cyan bg-edge-cyan/5'
                        : 'border-l-2 bg-edge-card border-edge-border'
                    }`}
                    style={
                      msg.role === 'agent' && selectedAgent
                        ? { borderLeftColor: selectedAgent.accent_color }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          msg.role === 'user' ? 'text-edge-cyan' : 'text-edge-green'
                        }`}
                      >
                        {msg.role === 'user' ? 'USER' : selectedAgent?.name}
                      </span>
                      <span className="font-mono text-[9px] text-edge-secondary">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-edge-primary whitespace-pre-wrap break-words leading-relaxed">
                      {msg.message}
                    </p>
                  </div>
                </div>
              ))}

              {loading && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="h-16 flex-shrink-0 border-t border-edge-border px-5 flex items-center gap-3 bg-edge-bg/30">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={loading}
                className="flex-1 bg-edge-terminal border border-edge-border rounded px-4 py-2.5 font-mono text-xs text-edge-primary placeholder:text-edge-secondary/50 focus:outline-none focus:border-edge-cyan transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !inputText.trim()}
                className="btn-glow font-mono text-xs px-5 py-2.5 rounded border border-edge-cyan/40 text-edge-cyan bg-edge-cyan/5 hover:bg-edge-cyan/15 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-edge-cyan" />
                SEND
              </button>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border border-edge-border flex items-center justify-center mx-auto mb-4">
                <span className="w-3 h-3 rounded-full bg-edge-cyan animate-pulse" />
              </div>
              <p className="font-mono text-sm text-edge-secondary">
                Select an agent to start chatting
              </p>
              <p className="font-mono text-[10px] text-edge-secondary/50 mt-2">
                Choose from the sidebar on the left
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
