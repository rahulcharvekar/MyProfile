import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { endpoints, getAgentQueryUrl } from '../lib/apiConfig';
import { queryAgent, uploadFile } from '../lib/apiClient';
import { makePrettyIdLabel, validateAttachment, makeWelcomeText, normalizeNewlines, parseBotResponse } from '../lib/chatUtils';
import useSessionId from '../hooks/useSessionId';
import useAgentMeta from '../hooks/useAgentMeta';
import useAutoScroll from '../hooks/useAutoScroll';
import Composer from './Composer/Composer';

export default function AIAssistant() {
  const navigate = useNavigate();
  const { agentId: agentFromPathParam } = useParams();
  const [searchParams] = useSearchParams();
  const agentFromUrl = searchParams.get('agent') || '';
  const [messages, setMessages] = useState([]);
  const [attachedFile, setAttachedFile] = useState(null); // File | null (kept and sent with each message until cleared)
  const [activeFile, setActiveFile] = useState(null);     // { name: string }
  // Selected agent is provided via URL param (from Welcome page).
  // We keep a small mapping for friendly labels and hints.

  const chatScrollRef = useRef(null);

  const ACCEPTED_EXT = /(\.pdf|\.csv|\.docx|\.doc|\.txt)$/i;
  const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
  const DEFAULT_AGENT_ID = import.meta.env.VITE_DEFAULT_AGENT_ID;
  const selectedAgentId = agentFromPathParam || agentFromUrl || (DEFAULT_AGENT_ID || "");
  const agentLabel = useMemo(() => makePrettyIdLabel(selectedAgentId), [selectedAgentId]);
  const { label: agentLabelApi, description: agentDescription, welcomeMessage: agentWelcomeMessage, commands: agentCommands, isUploadEnabled } = useAgentMeta(selectedAgentId);
  const agentTitle = useMemo(() => agentLabelApi || agentLabel, [agentLabelApi, agentLabel]);
  const agentHint = useMemo(() => agentDescription || 'You are now chatting with the selected agent.', [agentDescription]);
  const isUploadDisabled = !isUploadEnabled;

  // If no agent provided, redirect to welcome
  useEffect(() => {
    if (!selectedAgentId) navigate('/welcome', { replace: true });
  }, [selectedAgentId, navigate]);

  // Agent meta (moved to hook)

  // Clear any file state when uploads are disabled
  useEffect(() => {
    if (!isUploadEnabled) {
      setActiveFile(null);
      setAttachedFile(null);
    }
  }, [isUploadEnabled]);

  // Persist a session id so backend can keep chat history across turns
  const sessionId = useSessionId('ai_session_id');

  // Auto-scroll to latest message
  useAutoScroll(chatScrollRef, [messages]);

  // Seed a contextual welcome message when the agent changes.
  // If API welcomeMessage arrives after initial render, update the first
  // message from default -> API-provided text without duplicating.
  useEffect(() => {
    if (!selectedAgentId) return;
    setMessages((prev) => {
      // only add if first message or agent changed context
      const apiWelcome = normalizeNewlines(agentWelcomeMessage || '');
      if (prev.length === 0 || prev[0]?.meta !== selectedAgentId) {
        const welcome = makeWelcomeText({ apiWelcome, agentTitle, agentHint });
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

  // (removed duplicate clear-attachments effect; one exists above)

  const onFileSelected = async (file) => {
    if (isUploadDisabled || !file) return;
    const v = validateAttachment(file, { acceptRe: ACCEPTED_EXT, maxBytes: MAX_SIZE_BYTES });
    if (!v.ok) {
      alert(v.error === 'File too large' ? "File too large. Max allowed size is 200MB." : "Only PDF/CSV/DOCX/DOC/TXT files are allowed.");
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

  const onSend = async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, sender: 'user', type: 'text', text: trimmed }]);

    if (!getAgentQueryUrl(selectedAgentId)) return;
    setMessages((prev) => [...prev, { id: `typing-${Date.now()}`, sender: 'bot', type: 'typing', text: '__typing__' }]);

    try {
      const data = await queryAgent({
        input: trimmed,
        agent: selectedAgentId,
        sessionId,
        filename: activeFile?.name,
        // extraTools: [], // hook up here if you add UI for tool selection
      });
      const botText = parseBotResponse(data);
      endTypingWith(botText);
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || 'Error sending message.');
      endTypingWith(`❌ ${msg}`);
    }
  };

  const renderMessage = (m, i) => {
    const bubbleBase = "px-3 py-2 sm:px-4 sm:py-2 rounded-2xl max-w-[85%] sm:max-w-[70%] break-words whitespace-pre-wrap";
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
            <Composer
              key={`composer-${selectedAgentId}`}
              isUploadDisabled={!isUploadEnabled}
              agentCommands={agentCommands}
              onFileSelected={onFileSelected}
              onSend={onSend}
            />
            {!isUploadDisabled && attachedFile && (
              <div className="mt-2 text-xs text-gray-600">Attached: <span className="font-medium">{attachedFile.name}</span> <button type="button" onClick={onRemoveAttachment} className="ml-2 text-gray-400 hover:text-gray-700">✕</button></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
