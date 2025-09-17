import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { endpoints } from '../lib/apiConfig';
import { listAgents, queryAgent, uploadFile } from '../lib/apiClient';

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
  const DEFAULT_AGENT_ID = import.meta.env.VITE_DEFAULT_AGENT_ID;
  const selectedAgentId = agentFromPathParam || agentFromUrl || (DEFAULT_AGENT_ID || "");
  const agentLabel = useMemo(() => {
    if (!selectedAgentId) return '';
    return String(selectedAgentId)
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }, [selectedAgentId]);
  const [agentLabelApi, setAgentLabelApi] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [agentWelcomeMessage, setAgentWelcomeMessage] = useState('');
  const agentTitle = useMemo(() => agentLabelApi || agentLabel, [agentLabelApi, agentLabel]);
  const agentHint = useMemo(() => agentDescription || 'You are now chatting with the selected agent.', [agentDescription]);

  const [isUploadEnabled, setIsUploadEnabled] = useState(true);
  const isUploadDisabled = !isUploadEnabled;

  // If no agent provided, redirect to welcome
  useEffect(() => {
    if (!selectedAgentId) navigate('/welcome', { replace: true });
  }, [selectedAgentId, navigate]);

  // Fetch agent metadata to decide capabilities (incl. upload) and get description/welcome/label
  useEffect(() => {
    let isActive = true;
    const fetchMeta = async () => {
      if (!selectedAgentId || !endpoints.agentList) return;
      try {
        const { byId } = await listAgents();
        const entry = byId[selectedAgentId];
        if (entry) {
          // Prefer capabilities to decide upload visibility
          const caps = Array.isArray(entry.capabilities) ? entry.capabilities : [];
          if (caps.length) {
            const hasUpload = caps.some((c) => typeof c === 'string' && c.toLowerCase().includes('upload'));
            if (isActive) setIsUploadEnabled(Boolean(hasUpload));
          } else if (typeof entry.uploadEnabled === 'boolean') {
            if (isActive) setIsUploadEnabled(entry.uploadEnabled);
          }
        }
        if (entry) {
          if (isActive) setAgentLabelApi(entry.label || '');
          if (isActive) setAgentDescription(entry.description || '');
          if (isActive) setAgentWelcomeMessage(entry.welcomeMessage || '');
        }
      } catch (_) {
        // ignore errors; keep default
      }
    };
    fetchMeta();
    return () => { isActive = false; };
  }, [selectedAgentId]);

  // Clear any file state when uploads are disabled
  useEffect(() => {
    if (!isUploadEnabled) {
      setActiveFile(null);
      setAttachedFile(null);
    }
  }, [isUploadEnabled]);

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

  // Seed a contextual welcome message when the agent changes.
  // If API welcomeMessage arrives after initial render, update the first
  // message from default -> API-provided text without duplicating.
  useEffect(() => {
    if (!selectedAgentId) return;
    setMessages((prev) => {
      // only add if first message or agent changed context
      const apiWelcome = (agentWelcomeMessage || '').trim();
      if (prev.length === 0 || prev[0]?.meta !== selectedAgentId) {
        const defaultWelcome = `👋 You are now chatting with ${agentTitle || 'the selected'} agent.`;
        const welcome = apiWelcome || `${defaultWelcome} ${agentHint}`.trim();
        const welcomeSource = apiWelcome ? 'api' : 'default';
        return [{ id: `welcome-${Date.now()}`, meta: selectedAgentId, sender: 'bot', type: 'text', text: welcome, welcomeSource }];
      }
      // If we already showed a default welcome and API welcome becomes available, replace it.
      if (prev[0]?.meta === selectedAgentId && prev[0]?.welcomeSource === 'default' && apiWelcome) {
        const updated = [...prev];
        updated[0] = { ...updated[0], text: apiWelcome, welcomeSource: 'api' };
        return updated;
      }
      return prev;
    });
  }, [selectedAgentId, agentTitle, agentHint, agentWelcomeMessage]);

  // Clear attachments if uploads are disabled for the selected agent
  useEffect(() => {
    if (!isUploadEnabled) {
      setAttachedFile(null);
      setActiveFile(null);
    }
  }, [isUploadEnabled]);

  const onAttachClick = () => {
    if (isUploadDisabled) return;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e) => {
    if (isUploadDisabled) return;
    const file = e.target.files?.[0] || null;
    e.target.value = ""; // allow reselection of the same file
    if (!file) return;
    if (file.size > MAX_SIZE_BYTES) {
      alert("File too large. Max allowed size is 200MB.");
      return;
    }
    if (!ACCEPTED_EXT.test(file.name)) {
      alert("Only PDF or CSV files are allowed.");
      return;
    }

    // Show uploading bubble
    const uploadMsgId = `file-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: uploadMsgId, sender: "user", type: "file", file: { name: file.name, size: file.size, status: "uploading" } },
    ]);
    setAttachedFile(file);

    if (!endpoints.uploadSimple) return;

    try {
      try {
        const data = await uploadFile(file, { agent: selectedAgentId });
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
      } catch (errUp) {
        setMessages((prev) => prev.map((m) =>
          (m.id === uploadMsgId && m.type === 'file') ? { ...m, file: { ...m.file, status: 'error' } } : m
        ));
        const errText = (errUp?.data?.error || errUp?.data?.message || errUp?.message || 'Upload failed.');
        setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: 'bot', type: 'text', text: `❌ ${String(errText)}` }]);
        setAttachedFile(null);
        return;
      }
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
    if (!endpoints.agentQuery) return;
    // show typing
    setMessages((prev) => [...prev, { id: `typing-${Date.now()}`, sender: 'bot', type: 'typing', text: '__typing__' }]);

    try {
      const inputText = (!isUploadDisabled && activeFile?.name)
        ? `Answer using file '${activeFile.name}': ${trimmed}`
        : trimmed;
      const data = await queryAgent({ input: inputText, agent: selectedAgentId, sessionId: sessionIdRef.current });
      const botText =
        (typeof data?.response === 'string' && data.response) ||
        (typeof data === 'string' && data) ||
        data?.message ||
        '✅ Done.';
    endTypingWith(botText);
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || 'Error sending message.');
    endTypingWith(`❌ ${msg}`);
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
    <div className="text-gray-800">
      <div className="max-w-6xl mx-auto px-2 sm:px-6 py-1 sm:py-2">
        {/* Header (match Welcome layout) */}
        <div className="border-b-2 border-gray-200">
          <div className="flex sm:items-center justify-between py-1">
            <div className="relative flex items-center space-x-4">
              <div className="flex flex-col leading-tight">
                <div className="text-xl sm:text-2xl mt-1 flex items-center">
                  <span className="text-gray-700 mr-3">{agentTitle || 'AI Assistant'}</span>
                </div>
                {agentHint && <span className="text-sm text-gray-600">{agentHint}</span>}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button type="button" onClick={() => navigate('/welcome')} className="inline-flex items-center justify-center rounded-lg border h-9 w-9 text-gray-500 hover:bg-gray-100" title="Back" aria-label="Back">
                ←
              </button>
              {!isUploadDisabled && activeFile && (
                <button type="button" onClick={clearActiveFile} className="hidden sm:inline-flex items-center justify-center rounded-lg border h-9 px-2 text-gray-600 hover:bg-gray-100" title="Clear file">
                  <span className="truncate max-w-[8rem]">{activeFile.name}</span>
                  <span className="ml-2">✕</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content card */}
        <div className="mt-2 rounded-2xl bg-gray-100 p-3 sm:p-4">
          {/* Messages */}
          <div ref={chatScrollRef} id="messages" className="min-h-[40vh] max-h-[60vh] overflow-y-auto space-y-3 p-1">
            {messages.map(renderMessage)}
          </div>

          {/* Composer */}
          <div className="border-t-2 border-gray-200 pt-3 mt-2">
            <form onSubmit={onSend} className="relative flex">
              <span className="absolute inset-y-0 flex items-center">
                {!isUploadDisabled && (
                  <button type="button" onClick={onAttachClick} className="inline-flex items-center justify-center rounded-full h-10 w-10 text-gray-500 hover:bg-gray-300" title="Attach file" aria-label="Attach file">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6 text-gray-600">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                )}
              </span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Write your message!"
                className="w-full focus:outline-none focus:placeholder-gray-400 text-gray-700 placeholder-gray-600 pl-12 bg-white rounded-md py-3"
                aria-label="Message input"
              />
              <div className="absolute right-0 items-center inset-y-0 hidden sm:flex">
                <button type="submit" className="inline-flex items-center justify-center rounded-lg px-4 py-3 text-white bg-blue-500 hover:bg-blue-400">
                  <span className="font-bold">Send</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 ml-2 transform rotate-90">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
              {!isUploadDisabled && (
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.csv" className="hidden" onChange={onFileChange} />
              )}
            </form>
            {!isUploadDisabled && attachedFile && (
              <div className="mt-2 text-xs text-gray-600">Attached: <span className="font-medium">{attachedFile.name}</span> <button type="button" onClick={onRemoveAttachment} className="ml-2 text-gray-400 hover:text-gray-700">✕</button></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
