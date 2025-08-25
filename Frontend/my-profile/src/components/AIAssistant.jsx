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
  const currentFile = useRef(null);

  const UPLOAD_URL = import.meta.env.VITE_API_URL + "/upload";
  const INSIGHT_URL = import.meta.env.VITE_API_URL + "/get_insights/";
  const CHAT_URL = import.meta.env.VITE_API_URL + "/chat/";
  const DELETE_URL = import.meta.env.VITE_DELETE_URL;

  const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
  const MAX_SESSION_UPLOADS = 2;            // per session (successful uploads)
  const MAX_TOTAL_FILES = 3;                // distinct filenames (groups)
  const MAX_ATTEMPTS_PER_FILE = 5;          // attempts cap

  const uploadDisabled = sessionUploads >= MAX_SESSION_UPLOADS;

  // ---------- render helpers ----------
  function renderMessageBody(value) {
    // Render typing placeholder
    if (value === "__typing__") return <span>🧠 Typing...</span>;

    // React element
    if (React.isValidElement(value)) return value;

    // primitives
    if (typeof value === "string" || typeof value === "number") return String(value);

    // arrays
    if (Array.isArray(value)) {
      return value.map((item, idx) => <div key={idx}>{renderMessageBody(item)}</div>);
    }

    // objects (e.g. {response, sources})
    if (value && typeof value === "object") {
      const { response, sources } = value;
      const hasKnown = response !== undefined || sources !== undefined;

      return (
        <div className="space-y-2">
          {response !== undefined && <div>{renderMessageBody(response)}</div>}
          {Array.isArray(sources) && sources.length > 0 && (
            <ul className="list-disc pl-5">
              {sources.map((s, i) => (
                <li key={i}>{typeof s === "string" ? s : JSON.stringify(s)}</li>
              ))}
            </ul>
          )}
          {!hasKnown && (
            <pre className="text-xs overflow-auto">{JSON.stringify(value, null, 2)}</pre>
          )}
        </div>
      );
    }

    return "";
  }

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

  const patchAttempt = (list, fileName, attemptId, patch) =>
    list.map((g) => {
      if (g.name.toLowerCase() !== fileName.toLowerCase()) return g;
      return {
        ...g,
        attempts: g.attempts.map((a) => (a.id === attemptId ? { ...a, ...patch } : a)),
      };
    });

  const endTypingWith = (value) => {
    setMessages((prev) => {
      const copy = [...prev];
      if (copy[copy.length - 1]?.type === "typing") copy.pop();
      return [...copy, { text: value, sender: "bot", type: "text" }];
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

  // keep chat scrolled
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
    currentFile.current = g;
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

    setMessages([...base, { sender: "bot", text: "__typing__", type: "typing" }]);
    try {
      const res = await fetch(INSIGHT_URL + `${encodeURIComponent(fileName)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      const data = await res.json();

      if (!res.ok) {
        endTypingWith(`❌ Error starting chat for that file.`);
        return;
      }

      // Keep full object if present (so we can show sources)
      endTypingWith(typeof data === "object" ? data : (data?.response ?? "✅ Ready to chat about your file."));
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

    // optimistic attempt
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
        const nextG = { ...g, attempts: [...g.attempts, attempt], expanded: true };
        const next = [...prev];
        next[idx] = nextG;
        return next;
      }
    });

    if (view === "chat") {
      setMessages((prev) => [
        ...prev,
        { text: `📎 You uploaded: ${file.name}`, sender: "user", type: "text" },
        { text: "__typing__", sender: "bot", type: "typing" },
      ]);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });

      // IMPORTANT: parse JSON *before* checking res.ok, so we can show server error messages
      let data = null;
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse errors, keep data=null
      }

      if (!res.ok) {
        const msg = (data && (data.error || data.message || data.response)) || "Upload failed.";
        updateGroups((prev) => patchAttempt(prev, file.name, tempId, { status: "error" }));
        alert(msg);
        if (view === "chat") endTypingWith(`❌ Error uploading ${file.name}: ${msg}`);
        setPendingRetryFor(null);
        return;
      }

      const fileId = data?.fileId ?? data?.file_id ?? null;
      const outSize = typeof data?.size === "number" ? data.size : file.size;

      // success
      updateGroups((prev) =>
        patchAttempt(prev, file.name, tempId, { status: "ready", serverId: fileId, size: outSize })
      );
      setSessionUploads((n) => n + 1);

      if (view === "chat") {
        // keep object if provided, else show a friendly message
        const botPayload = data && typeof data === "object"
          ? (data.response || data.sources ? data : { response: "✅ Upload successful." })
          : { response: `✅ ${file.name} uploaded successfully.` };
        endTypingWith(botPayload);
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
    const file = currentFile?.current?.name || "";
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { text: trimmed, sender: "user", type: "text" },
      { text: "__typing__", sender: "bot", type: "typing" },
    ]);
    setInput("");

    try {
      const res = await fetch(CHAT_URL + `${encodeURIComponent(file)}` + "/" + `${encodeURIComponent(trimmed)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, fileId: currentAttemptId }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error || data?.message || "Not Able to reach server. Please try again later.";
        endTypingWith(`❌ ${errorMsg}`);
        return;
      }

      // Keep full object if server returns {response, sources}
      endTypingWith(typeof data === "object" ? data : (data?.response ?? String(data)));
    } catch {
      endTypingWith("❌ Error starting chat for that file.");
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
                        {/* Retry upload */}
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
                  {renderMessageBody(m.text)}
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
