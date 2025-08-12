import React, { useEffect, useRef, useState } from "react";

// Toggle Reset button via .env: VITE_DEV_MODE="true"
const isDev = (import.meta.env.VITE_DEV_MODE === "true");

export default function AIAssistantWidget() {
  const [view, setView] = useState("workspace");
  const [groups, setGroups] = useState([]); // [{ name, attempts: [{id,status,size,serverId,at}], expanded?:bool }]
  const [currentAttemptId, setCurrentAttemptId] = useState(null);
  const [sessionUploads, setSessionUploads] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // which filename we’re retrying (if any)
  const [pendingRetryFor, setPendingRetryFor] = useState(null);

  const uploadRef = useRef(null);
  const chatScrollRef = useRef(null);

  const UPLOAD_URL = import.meta.env.VITE_API_URL;
  const CHAT_URL = import.meta.env.VITE_CHAT_URL || "http://localhost:8000/chat";
  const DELETE_URL = import.meta.env.VITE_DELETE_URL;

  const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
  const MAX_SESSION_UPLOADS = 2;            // per session (successful uploads)
  const MAX_TOTAL_FILES = 3;                // distinct filenames (groups)
  const MAX_ATTEMPTS_PER_FILE = 5;          // attempts cap

  const uploadDisabled = sessionUploads >= MAX_SESSION_UPLOADS;

  // ---------- helpers: always update from latest state ----------
  const updateGroups = (producer) => {
    setGroups((prev) => {
      const next = producer(prev);
      localStorage.setItem("uploadedGroups", JSON.stringify(next));
      return next;
    });
  };

  const findGroupIdx = (list, name) =>
    list.findIndex((g) => g.name.toLowerCase() === name.toLowerCase());

  const getLatestAttempt = (g) =>
    g?.attempts?.length ? g.attempts[g.attempts.length - 1] : null;

  // patch a specific attempt on the latest state
  const patchAttempt = (list, fileName, attemptId, patch) =>
    list.map((g) => {
      if (g.name.toLowerCase() !== fileName.toLowerCase()) return g;
      return {
        ...g,
        attempts: g.attempts.map((a) => (a.id === attemptId ? { ...a, ...patch } : a)),
      };
    });

  const endTypingWith = (text) => {
    setMessages((prev) => {
      const copy = [...prev];
      if (copy[copy.length - 1]?.type === "typing") copy.pop();
      return [...copy, { text, sender: "bot", type: "text" }];
    });
  };

  // ---------- init / migrate ----------
  useEffect(() => {
    const savedGroups = JSON.parse(localStorage.getItem("uploadedGroups") || "[]");
    if (savedGroups.length) {
      setGroups(savedGroups);
      return;
    }
    const oldFlat = JSON.parse(localStorage.getItem("uploadedFiles") || "[]");
    if (!oldFlat.length) return;
    const migrated = [];
    oldFlat.forEach((f) => {
      const idx = migrated.findIndex((g) => g.name.toLowerCase() === f.name.toLowerCase());
      const attempt = {
        id: f.id,
        status: f.status || "ready",
        size: f.size,
        serverId: f.serverId || null,
        at: new Date().toISOString(),
      };
      if (idx === -1) migrated.push({ name: f.name, attempts: [attempt], expanded: false });
      else migrated[idx].attempts.push(attempt);
    });
    const withExpand = migrated.map((g) => ({ ...g, expanded: g.attempts.length > 1 }));
    localStorage.setItem("uploadedGroups", JSON.stringify(withExpand));
    setGroups(withExpand);
    localStorage.removeItem("uploadedFiles");
  }, []);

  // Keep only the chat pane scrolling
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ---------- delete group ----------
  const deleteGroup = async (name) => {
    let prevSnapshot = [];
    updateGroups((prev) => {
      prevSnapshot = prev;
      const idx = findGroupIdx(prev, name);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
    try {
      if (DELETE_URL) {
        const g = prevSnapshot.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (g) {
          const payload = {
            files: g.attempts
              .filter((a) => a.serverId)
              .map((a) => ({ fileId: a.serverId, fileName: g.name })),
          };
          if (payload.files.length) {
            await fetch(DELETE_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
      // rollback
      localStorage.setItem("uploadedGroups", JSON.stringify(prevSnapshot));
      setGroups(prevSnapshot);
      alert("Couldn't delete on server. Restoring the item.");
    }
  };

  // ---------- open chat ----------
  const openChat = async (fileName) => {
    const g = groups.find((x) => x.name.toLowerCase() === fileName.toLowerCase());
    if (!g) return;
    const latest = getLatestAttempt(g);

    setCurrentAttemptId(latest?.id || null);
    setView("chat");

    const base = [
      { sender: "bot", text: "👋 Hi! You can ask a question or upload a file to get started.", type: "text" },
      { sender: "bot", text: `✅ Selected file: ${fileName}`, type: "text" },
    ];

    if (!latest || latest.status !== "ready") {
      setMessages([
        ...base,
        { sender: "bot", text: `⏳ Latest attempt is not ready. Please retry the upload for this file.`, type: "text" },
      ]);
      return;
    }

    setMessages([...base, { sender: "bot", text: "🧠 Typing...", type: "typing" }]);
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      const data = await res.json();
      endTypingWith(data.response ?? "✅ Ready to chat about your file.");
    } catch {
      endTypingWith("❌ Error starting chat for that file.");
    }
  };

  // ---------- upload (supports retry with same filename) ----------
  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking same file again
    if (!file) {
      setPendingRetryFor(null);
      return;
    }

    // validate caps & types using latest state
    const current = groups;
    const existingGroup = current.find((g) => g.name.toLowerCase() === file.name.toLowerCase());
    const hasReady = existingGroup?.attempts?.some((a) => a.status === "ready");
    const attemptCount = existingGroup?.attempts?.length || 0;

    if (pendingRetryFor && pendingRetryFor.toLowerCase() !== file.name.toLowerCase()) {
      alert(`Please select the same file name: "${pendingRetryFor}"`);
      setPendingRetryFor(null);
      return;
    }
    if (!existingGroup && current.length >= MAX_TOTAL_FILES) {
      alert(`You can keep up to ${MAX_TOTAL_FILES} files. Please delete some first.`);
      setPendingRetryFor(null);
      return;
    }
    if (existingGroup && attemptCount >= MAX_ATTEMPTS_PER_FILE) {
      const msg = `Max attempts reached (${MAX_ATTEMPTS_PER_FILE}) for "${file.name}".`;
      alert(msg);
      if (view === "chat") setMessages((prev) => [...prev, { text: `❌ ${msg}`, sender: "bot", type: "text" }]);
      setPendingRetryFor(null);
      return;
    }
    if (uploadDisabled) {
      alert(`You can upload only ${MAX_SESSION_UPLOADS} files per session.`);
      setPendingRetryFor(null);
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      const msg = "❌ File too large. Max allowed size is 200MB.";
      if (view === "chat") setMessages((prev) => [...prev, { text: msg, sender: "bot", type: "text" }]);
      alert("File too large. Maximum allowed size is 200 MB.");
      setPendingRetryFor(null);
      return;
    }
    const allowed = [
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowed.includes(file.type) && !/[.](pdf|txt|csv)$/i.test(file.name)) {
      const msg = "❌ Only PDF, TXT, or CSV files are allowed.";
      if (view === "chat") setMessages((prev) => [...prev, { text: msg, sender: "bot", type: "text" }]);
      alert("Only PDF, TXT, or CSV files are allowed.");
      setPendingRetryFor(null);
      return;
    }
    if (!pendingRetryFor && hasReady) {
      const msg = `A file named ${file.name} already exists.`;
      if (view === "chat") setMessages((prev) => [...prev, { text: `❌ ${msg}`, sender: "bot", type: "text" }]);
      alert(msg);
      return;
    }

    // optimistic attempt (functional update)
    const tempId = `temp-${Date.now()}`;
    updateGroups((prev) => {
      const idx = findGroupIdx(prev, file.name);
      const attempt = {
        id: tempId,
        status: "uploading",
        size: file.size,
        serverId: null,
        at: new Date().toISOString(),
      };
      if (idx === -1) {
        return [...prev, { name: file.name, attempts: [attempt], expanded: false }];
      } else {
        const g = prev[idx];
        const nextG = { ...g, attempts: [...g.attempts, attempt], expanded: true }; // auto-expand
        const next = [...prev];
        next[idx] = nextG;
        return next;
      }
    });

    if (view === "chat") {
      setMessages((prev) => [
        ...prev,
        { text: `📎 You uploaded: ${file.name}`, sender: "user", type: "text" },
        { text: "🧠 Typing...", sender: "bot", type: "typing" },
      ]);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });

      let data = null;
      try { data = await res.json(); } catch (err){console.error("Failed to parse JSON response:", err); }

      const apiMsg = () =>
        (data && (data.error || data.message || data.detail || data.response)) || `HTTP ${res.status}`;

      if (res.status === 409) {
        const msg = apiMsg();
        updateGroups((prev) => patchAttempt(prev, file.name, tempId, { status: "error" }));
        alert(msg);
        if (view === "chat") endTypingWith(`❌ ${msg}`);
        setPendingRetryFor(null);
        return;
      }

      if (!res.ok) {
        const msg = apiMsg();
        updateGroups((prev) => patchAttempt(prev, file.name, tempId, { status: "error" }));
        alert(msg);
        if (view === "chat") endTypingWith(`❌ Error uploading ${file.name}: ${msg}`);
        setPendingRetryFor(null);
        return;
      }

      const fileId = data?.fileId ?? data?.file_id;
      const outSize = typeof data?.size === "number" ? data.size : file.size;

      if (data?.success === false || !fileId) {
        const msg = apiMsg() || "Upload failed";
        updateGroups((prev) => patchAttempt(prev, file.name, tempId, { status: "error" }));
        alert(msg);
        if (view === "chat") endTypingWith(`❌ Error uploading ${file.name}: ${msg}`);
        setPendingRetryFor(null);
        return;
      }

      // success
      updateGroups((prev) =>
        patchAttempt(prev, file.name, tempId, { status: "ready", serverId: fileId, size: outSize })
      );
      setSessionUploads((n) => n + 1);

      if (view === "chat") {
        const botText = data?.response || `✅ ${file.name} uploaded successfully.`;
        endTypingWith(botText);
      }
    } catch (err) {
      console.error(err);
      updateGroups((prev) => patchAttempt(prev, file.name, tempId, { status: "error" }));
      if (view === "chat") endTypingWith(`❌ Error uploading ${file.name}.`);
    } finally {
      setPendingRetryFor(null);
    }
  };

  // ---------- send message ----------
  const onSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { text: trimmed, sender: "user", type: "text" }]);
    setInput("");

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, fileId: currentAttemptId }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { text: data.response, sender: "bot", type: "text" }]);
    } catch {
      setMessages((prev) => [...prev, { text: "❌ Error: Unable to reach server.", sender: "bot", type: "text" }]);
    }
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden">
      {view === "workspace" && (
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-10">
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Your Workspace</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`rounded-xl px-4 py-2 text-sm w-full sm:w-auto text-white ${uploadDisabled ? "bg-slate-400 cursor-not-allowed" : "bg-blue-800 hover:bg-blue-600"}`}
                onClick={() => !uploadDisabled && uploadRef.current?.click()}
                disabled={uploadDisabled}
                title={uploadDisabled ? "Upload limit reached (2 files per session)" : "Upload New"}
                aria-label="Upload new file"
              >
                Upload New
              </button>

              {isDev && (
                <button
                  className="rounded-xl px-3 py-2 text-sm w-full sm:w-auto border border-slate-200 hover:bg-slate-50"
                  onClick={() => {
                    localStorage.removeItem("uploadedGroups");
                    setGroups([]);
                    setSessionUploads(0);
                    setMessages([]);
                    alert("Reset complete (local only).");
                  }}
                  title="Clears local file list and session counter"
                >
                  Reset (test)
                </button>
              )}

              <span className="text-xs text-slate-500 w-full sm:w-auto">
                Session uploads: {sessionUploads}/{MAX_SESSION_UPLOADS}
              </span>
              <input ref={uploadRef} type="file" accept=".pdf,.txt,.csv" className="hidden" onChange={onUpload} />
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            Upload files to get AI assistance. You can retry failed uploads (up to {MAX_ATTEMPTS_PER_FILE} attempts per file).
          </p>
          <hr className="my-4 sm:my-6 border-t border-slate-300" />

          {groups.length === 0 ? (
            <div className="mt-8 text-center text-sm sm:text-base">No uploaded files so far</div>
          ) : (
            <ul className="mt-4 sm:mt-8 divide-y divide-slate-200 border rounded-2xl bg-white">
              {groups.map((g, idx) => {
                const latest = getLatestAttempt(g);
                const latestStatus = latest?.status || "—";
                const canChat = latestStatus === "ready";
                const retriesLeft = Math.max(0, MAX_ATTEMPTS_PER_FILE - (g.attempts?.length || 0));

                return (
                  <li key={g.name + idx} className="p-4">
                    {/* Header row */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            className="transition-transform"
                            onClick={() =>
                              updateGroups((prev) => {
                                const i = findGroupIdx(prev, g.name);
                                if (i === -1) return prev;
                                const next = [...prev];
                                next[i] = { ...prev[i], expanded: !prev[i].expanded };
                                return next;
                              })
                            }
                            aria-label={g.expanded ? "Collapse attempts" : "Expand attempts"}
                            title={g.expanded ? "Collapse attempts" : "Expand attempts"}
                          >
                            <span
                              className={`inline-block w-3 h-3 border-t-2 border-r-2 border-slate-500 rotate-45 mt-0.5 ${
                                g.expanded ? "transform rotate-[225deg]" : ""
                              }`}
                            />
                          </button>
                          <p className="truncate font-medium text-slate-900">{g.name}</p>
                        </div>

                        <div className="mt-1 flex items-center flex-wrap gap-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                              latestStatus === "uploading"
                                ? "bg-amber-100 text-amber-800"
                                : latestStatus === "ready"
                                ? "bg-emerald-100 text-emerald-800"
                                : latestStatus === "error"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {latestStatus}
                          </span>
                          {latest?.size != null && (
                            <span className="text-xs text-slate-500">
                              {(latest.size / 1024).toFixed(1)} KB
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            Attempts: {g.attempts.length}/{MAX_ATTEMPTS_PER_FILE} · Retries left: {retriesLeft}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {/* Retry upload button when latest failed and attempts remain */}
                        {latestStatus === "error" && retriesLeft > 0 && (
                          <button
                            onClick={() => {
                              setPendingRetryFor(g.name);
                              uploadRef.current?.click();
                            }}
                            className="border rounded px-3 py-2 text-sm hover:bg-amber-50 border-amber-200 text-amber-800 w-full sm:w-auto"
                            title={`Retry upload (${retriesLeft} left)`}
                          >
                            Retry upload ({retriesLeft} left)
                          </button>
                        )}
                        <button
                          onClick={() => canChat && openChat(g.name)}
                          disabled={!canChat}
                          title={canChat ? "Open chat" : "Chat enabled after a successful upload"}
                          className={`border rounded px-3 py-2 text-sm w-full sm:w-auto ${
                            canChat ? "hover:bg-slate-50" : "opacity-50 cursor-not-allowed"
                          }`}
                        >
                          Get AI Assistance
                        </button>
                        <button
                          onClick={() => deleteGroup(g.name)}
                          className="border rounded px-3 py-2 text-sm hover:bg-rose-50 text-rose-700 border-rose-200 w-full sm:w-auto"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Collapsible attempts history */}
                    {g.expanded && (
                      <div className="mt-3 rounded-lg border bg-slate-50">
                        <div className="divide-y">
                          {g.attempts.map((a) => (
                            <div key={a.id} className="p-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm text-slate-800">
                                  Attempt at{" "}
                                  <span className="font-medium">
                                    {new Date(a.at).toLocaleString()}
                                  </span>
                                </p>
                                <p className="text-xs text-slate-500">
                                  {(a.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <span
                                className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-xs ${
                                  a.status === "uploading"
                                    ? "bg-amber-100 text-amber-800"
                                    : a.status === "ready"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : a.status === "error"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {a.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {view === "chat" && (
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-10 flex flex-col h-[70vh] sm:h-[80vh]">
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto border rounded-2xl p-3 sm:p-4 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`mb-3 flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`px-3 py-2 sm:px-4 sm:py-2 rounded-2xl max-w-[85%] sm:max-w-[70%] break-words ${
                  m.sender === "user" ? "bg-indigo-600 text-white" : "bg-white border"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSendMessage} className="mt-3 sm:mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 border rounded-xl px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base"
              placeholder="Type your message..."
              aria-label="Message input"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 sm:px-5 py-2 rounded-xl text-sm sm:text-base"
              aria-label="Send message"
            >
              Send
            </button>
          </form>

          <button
            onClick={() => setView("workspace")}
            className="mt-3 sm:mt-4 text-sm text-indigo-600 hover:underline self-start"
            aria-label="Back to files"
          >
            Back to My Files
          </button>
        </div>
      )}
    </div>
  );
}
