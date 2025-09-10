import React, { useEffect, useRef, useState } from "react";

// Clean ChatGPT-like UI only (no API integration yet)
// - Scrollable conversation
// - + button to attach one file (pdf/txt/csv)
// - Sending shows user's text and optional file bubble

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { id: "welcome", sender: "bot", type: "text", text: "👋 Hi! Ask a question to get started." },
  ]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState(null); // File | null (kept and sent with each message until cleared)
  const [activeFile, setActiveFile] = useState(null);     // { name: string }

  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const ACCEPTED_EXT = /(\.pdf|\.txt|\.csv)$/i;
  const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
  // Single endpoint to handle chat (agent orchestrates tools server-side)
  const QUERY_URL = import.meta.env.VITE_AGENT_QUERY_URL || import.meta.env.VITE_API_URL;
  const DEFAULT_AGENT_ID = import.meta.env.VITE_DEFAULT_AGENT_ID;

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
      alert("Only PDF, TXT, or CSV files are allowed.");
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
        ...(DEFAULT_AGENT_ID ? { agent: DEFAULT_AGENT_ID } : {}),
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 pb-10 flex flex-col h-[70vh] sm:h-[80vh]">
        {/* Header */}
        <div className="py-3 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">AI Assistant</h2>
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

        {/* Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto border rounded-2xl p-3 sm:p-4 bg-slate-50">
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
    </div>
  );
}
