import { useState, useCallback } from 'react';
import axios from 'axios';
import type { ChatMessage } from '../types';

const API_BASE = 'http://localhost:8800';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

interface UseChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (agentId: string, message: string) => Promise<void>;
  loadHistory: (agentId: string) => Promise<void>;
  clearHistory: (agentId: string) => Promise<void>;
  clearLocal: (agentId: string) => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (agentId: string, message: string) => {
    const userMsg: ChatMessage = {
      id: Date.now(),
      agent_id: agentId,
      role: 'user',
      message,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post<ChatMessage>('/chat', {
        agent_id: agentId,
        message,
      });
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      const mockResponse: ChatMessage = {
        id: Date.now() + 1,
        agent_id: agentId,
        role: 'agent',
        message: `[MOCK] Agent ${agentId} received: "${message}". (Fleet API not connected — running in mock mode)`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, mockResponse]);
      setError('Fleet API unreachable — mock response');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (agentId: string) => {
    try {
      const { data } = await api.get<ChatMessage[]>(`/chat/${agentId}/history`);
      setMessages(data);
    } catch {
      setMessages([]);
    }
  }, []);

  const clearHistory = useCallback(async (agentId: string) => {
    try {
      await api.delete(`/chat/${agentId}/history`);
      setMessages([]);
    } catch {
      setMessages([]);
    }
  }, []);

  const clearLocal = useCallback((agentId: string) => {
    setMessages([]);
  }, []);

  return { messages, loading, error, sendMessage, loadHistory, clearHistory, clearLocal };
}

export default useChat;
