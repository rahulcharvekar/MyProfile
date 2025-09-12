import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';

// Clean ChatGPT-like UI only (no API integration yet)
// - Scrollable conversation
// - + button to attach one file (pdf/csv)
// - Sending shows user's text and optional file bubble

export default function AIAssistant() {
  const navigate = useNavigate();
  const { agentId: agentFromPathParam } = useParams();
  const [searchParams] = useSearchParams();
  const agentFromUrl = searchParams.get('agent') || '';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState(null); // File | null (kept and sent with each message until cleared)
  const [activeFile, setActiveFile] = useState(null);     // { name: string }
  // Selected agent is provided via URL param (from Welcome page).
  // We keep a small mapping for friendly labels and hints.

  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const ACCEPTED_EXT = /(\.pdf|\.csv)$/i;
  const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
  // Single endpoint to handle chat (agent orchestrates tools server-side)
  const QUERY_URL = import.meta.env.VITE_AGENT_QUERY_URL || import.meta.env.VITE_API_URL;
  const DEFAULT_AGENT_ID = import.meta.env.VITE_DEFAULT_AGENT_ID;
  const selectedAgentId = agentFromPathParam || agentFromUrl || (DEFAULT_AGENT_ID || "");
  const agentLabel = useMemo(() => {
    if (!selectedAgentId) return '';
    return String(selectedAgentId)
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }, [selectedAgentId]);
  const agentHint = useMemo(() => {
    const id = String(selectedAgentId || '').toLowerCase();
    if (id === 'default') return 'General assistant over uploaded documents.';
    if (id === 'chat_only' || id === 'chat-only') return 'Answers questions over a specified file.';
    return 'You are now chatting with the selected agent.';
  }, [selectedAgentId]);

  // If no agent provided, redirect to welcome
  useEffect(() => {
    if (!selectedAgentId) navigate('/welcome', { replace: true });
  }, [selectedAgentId, navigate]);

  // Prefer explicit upload URL from env, with fallback based on QUERY_URL
  const SIMPLE_UPLOAD_URL = (() => {
    const fromEnv = import.meta.env.VITE_UPLOAD_URL;
    if (fromEnv) return fromEnv;
    try {
      const u = new URL(String(QUERY_URL || ""), window.location.origin);
      return `${u.protocol}//${u.host}/upload/simple`;
    } catch (_) {
      return "";
    }
  })();

  // Persist a session id so backend can keep chat history across turns
  const sessionIdRef = useRef(null);
  if (!sessionIdRef.current) {
    try {
      const existing = localStorage.getItem('ai_session_id');
      if (existing) {
        sessionIdRef.current = existing;
      } else {
        const sid = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem('ai_session_id', sid);
        sessionIdRef.current = sid;
      }
    } catch (_) {
      sessionIdRef.current = `web-${Date.now()}`;
    }
  }

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Seed a contextual welcome message when the agent changes
  useEffect(() => {
    if (!selectedAgentId) return;
    setMessages((prev) => {
      // only add if first message or agent changed context
      if (prev.length === 0 || prev[0]?.meta !== selectedAgentId) {
        const welcome = `👋 You are now chatting with ${agentLabel || 'the selected'} agent. ${agentHint}`.trim();
        return [{ id: `welcome-${Date.now()}`, meta: selectedAgentId, sender: 'bot', type: 'text', text: welcome }];
      }
      return prev;
    });
  }, [selectedAgentId, agentLabel, agentHint]);

  const onAttachClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = ""; // allow reselection of the same file
    if (!file) return;
    if (file.size > MAX_SIZE_BYTES) {
      alert("File too large. Max allowed size is 200MB.");
      return;
    }
    if (!ACCEPTED_EXT.test(file.name)) {
      alert("Only PDF orr CSV files are allowed.");
      return;
    }

    // Show uploading bubble
    const uploadMsgId = `file-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: uploadMsgId, sender: "user", type: "file", file: { name: file.name, size: file.size, status: "uploading" } },
    ]);
    setAttachedFile(file);

    if (!SIMPLE_UPLOAD_URL) return;

    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const res = await fetch(SIMPLE_UPLOAD_URL, { method: 'POST', body: formData });
      let data = null;
      try { data = await res.json(); } catch (_) { /* noop */ }
      if (!res.ok) {
        setMessages((prev) => prev.map((m) =>
          (m.id === uploadMsgId && m.type === 'file') ? { ...m, file: { ...m.file, status: 'error' } } : m
        ));
        const errText = (data?.error || data?.message || 'Upload failed.');
        setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: 'bot', type: 'text', text: `❌ ${String(errText)}` }]);
        setAttachedFile(null);
        return;
      }

      // Mark uploaded and set active file name, then print response
      setMessages((prev) => prev.map((m) =>
        (m.id === uploadMsgId && m.type === 'file') ? { ...m, file: { ...m.file, status: 'ready' } } : m
      ));
      setActiveFile({ name: file.name });
      setAttachedFile(null);

      const status = data?.status || 'uploaded';
      const message = data?.message || 'File uploaded.';
      const fileHash = data?.file_hash ? ` (hash: ${String(data.file_hash).slice(0, 12)}…)` : '';
      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, sender: 'bot', type: 'text', text: `✅ ${file.name} ${status}.${fileHash}\n${message}` },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.map((m) =>
        (m.id === uploadMsgId && m.type === 'file') ? { ...m, file: { ...m.file, status: 'error' } } : m
      ));
      setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: 'bot', type: 'text', text: '❌ Error uploading file.' }]);
      setAttachedFile(null);
    }
  };

  const onRemoveAttachment = () => setAttachedFile(null);
  const clearActiveFile = () => setActiveFile(null);

  const endTypingWith = (text) => {
    setMessages((prev) => {
      const copy = [...prev];
      if (copy[copy.length - 1]?.type === 'typing') copy.pop();
      return [...copy, { id: `bot-${Date.now()}`, sender: 'bot', type: 'text', text: String(text) }];
    });
  };

  const onSend = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const nextMsgs = [];
    nextMsgs.push({ id: `msg-${Date.now()}`, sender: "user", type: "text", text: trimmed });
    if (nextMsgs.length) setMessages((prev) => [...prev, ...nextMsgs]);

    setInput("");
    
    // If endpoint configured, send the message as JSON
    if (!QUERY_URL) return;
    // show typing
    setMessages((prev) => [...prev, { id: `typing-${Date.now()}`, sender: 'bot', type: 'typing', text: '__typing__' }]);

    try {
      const inputText = activeFile?.name
        ? `Answer using file '${activeFile.name}': ${trimmed}`
        : trimmed;
      const payload = {
        input: inputText,
        agent: selectedAgentId,
        session_id: sessionIdRef.current,
      };
      const res = await fetch(QUERY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data = null;
      try { data = await res.json(); } catch (err) { void err; }
      if (!res.ok) {
        // Try to read text if JSON not available
        let textFallback = '';
        try { textFallback = await res.text(); } catch (_) { /* noop */ }
        const errText = (data?.error || data?.message || textFallback || 'Not Able to reach server. Please try again later.');
        endTypingWith(`❌ ${String(errText)}`);
        return;
      }
      const botText =
        (typeof data?.response === 'string' && data.response) ||
        (typeof data === 'string' && data) ||
        data?.message ||
        '✅ Done.';
      endTypingWith(botText);
    } catch (err) {
      console.error(err);
      endTypingWith('❌ Error sending message.');
    }
  };

  const renderMessage = (m, i) => {
    const bubbleBase = "px-3 py-2 sm:px-4 sm:py-2 rounded-2xl max-w-[85%] sm:max-w-[70%] break-words";
    const align = m.sender === "user" ? "justify-end" : "justify-start";
    const color = m.sender === "user" ? "bg-indigo-600 text-white" : "bg-white border";

    if (m.type === "file") {
      return (
        <div key={m.id || i} className={`mb-3 flex ${align}`}>
          <div className={`${bubbleBase} ${color}`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-200 text-slate-700">📄</span>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate" title={m.file?.name}>{m.file?.name}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  {typeof m.file?.size === "number" && <span>{(m.file.size / 1024).toFixed(1)} KB</span>}
                  {m.file?.status === "uploading" && (
                    <>
                      <span className="inline-block h-3 w-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      <span>Uploading…</span>
                    </>
                  )}
                  {m.file?.status === "ready" && <span>✅ Uploaded</span>}
                  {m.file?.status === "error" && <span className="text-rose-500">❌ Failed</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (m.type === 'typing') {
      return (
        <div key={m.id || i} className={`mb-3 flex ${align}`}>
          <div className={`${bubbleBase} ${color}`}>🧠 Typing...</div>
        </div>
      );
    }

    return (
      <div key={m.id || i} className={`mb-3 flex ${align}`}>
        <div className={`${bubbleBase} ${color}`}>{String(m.text ?? "")}</div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
      {/* Back link above the header */}
      <div className="pt-3 pb-1">
        <a
          href="#/welcome"
          onClick={(e) => { e.preventDefault(); navigate('/welcome'); }}
          className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
          aria-label="Back to Welcome"
          title="Back"
        >
          <span aria-hidden>←</span>
          <span>Back</span>
        </a>
      </div>
      {/* Header */}
      <div className="py-2 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">AI Assistant</h2>
          <div className="flex items-center gap-3">
            {/* Active agent indicator */}
            <div className="text-xs sm:text-sm text-slate-700">
              <span className="mr-1 text-slate-500">Agent:</span>
              <span className="font-medium">{agentLabel || 'N/A'}</span>
            </div>
            {/* Active file indicator */}
            <div className="text-xs sm:text-sm text-slate-600">
              {activeFile ? (
                <span title={activeFile.name} className="inline-flex items-center gap-2">
                  Using file: <span className="font-medium">{activeFile.name}</span>
                  <button type="button" onClick={clearActiveFile} className="ml-1 text-slate-400 hover:text-slate-700" aria-label="Clear active file">✕</button>
                </span>
              ) : (
                <span className="text-slate-400">No file selected</span>
              )}
            </div>
          </div>
        </div>

      {/* Agent-specific hint */}
      {agentHint && (
        <div className="mb-2 text-xs sm:text-sm text-slate-600">{agentHint}</div>
      )}

      {/* Messages */}
      <div ref={chatScrollRef} className="min-h-[40vh] max-h-[65vh] overflow-y-auto border rounded-2xl p-3 sm:p-4 bg-slate-50">
        {messages.map(renderMessage)}
      </div>

      {/* Composer */}
      <form onSubmit={onSend} className="mt-3 sm:mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onAttachClick}
            className="rounded-lg border px-3 py-2 text-sm bg-white hover:bg-slate-50"
            title="Upload file"
            aria-label="Upload file"
          >
            +
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.csv"
            className="hidden"
            onChange={onFileChange}
          />

          {attachedFile && (
            <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-slate-700">
              <span className="truncate max-w-[10rem]" title={attachedFile.name}>{attachedFile.name}</span>
              <button type="button" onClick={onRemoveAttachment} aria-label="Remove attachment" className="text-slate-400 hover:text-slate-700">✕</button>
            </span>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border rounded-xl px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base"
            placeholder="Type your message..."
            aria-label="Message input"
          />
          <button
            type="submit"
            className="text-white px-4 sm:px-5 py-2 rounded-xl text-sm sm:text-base bg-indigo-600 hover:bg-indigo-500"
            aria-label="Send message"
          >
            Send
          </button>
      </form>
    </div>
  );
}
