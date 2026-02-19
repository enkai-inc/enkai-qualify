'use client';

import { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';

export function RefinementInput() {
  const { refine, isRefining, conversation, error, clearError } = useWorkspaceStore();
  const [input, setInput] = useState('');
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  useEffect(() => {
    if (error?.startsWith('RATE_LIMITED:')) {
      const seconds = parseInt(error.split(':')[1], 10) || 60;
      setRateLimitMessage(`Rate limited. Try again in ${seconds} seconds.`);
      clearError();
      if (rateLimitTimerRef.current) {
        clearTimeout(rateLimitTimerRef.current);
      }
      rateLimitTimerRef.current = setTimeout(() => {
        setRateLimitMessage(null);
        rateLimitTimerRef.current = null;
      }, seconds * 1000);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (error && !error.startsWith('RATE_LIMITED:')) {
      setErrorMessage(error);
      clearError();
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
      errorTimerRef.current = setTimeout(() => {
        setErrorMessage(null);
        errorTimerRef.current = null;
      }, 10000);
    }
  }, [error, clearError]);

  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) {
        clearTimeout(rateLimitTimerRef.current);
      }
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRefining) return;

    const prompt = input.trim();
    setInput('');
    await refine(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Refine Your Idea</h2>
        <p className="text-sm text-gray-500">Chat with AI to improve and iterate on your idea</p>
      </div>

      {conversation.length > 0 && (
        <div className="max-h-64 overflow-y-auto p-4 space-y-4">
          {conversation.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                  }`}
                >
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isRefining && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                  </div>
                  <span className="text-sm text-gray-500">Refining...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            aria-label="Refine your idea"
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Describe how you'd like to refine this idea..."
            disabled={isRefining}
            maxLength={1000}
            className="flex-1 resize-none px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || isRefining}
            aria-label={isRefining ? "Sending message" : "Send message"}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isRefining ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Press Enter to send, Shift+Enter for new line</p>
        {rateLimitMessage && (
          <p className="text-sm text-amber-600 mt-2">{rateLimitMessage}</p>
        )}
        {errorMessage && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-red-600">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-gray-400 hover:text-gray-600 ml-2"
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
