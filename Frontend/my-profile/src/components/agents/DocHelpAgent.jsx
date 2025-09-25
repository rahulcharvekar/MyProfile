import React, { useCallback, useMemo, useRef, useState } from 'react';
import { uploadFile, queryAgent, resolveUploadedFilename } from '../../lib/apiClient';
import { parseBotResponse, validateAttachment } from '../../lib/chatUtils';

const DOCHELP_AGENT_ID = 'dochelp';
const ACCEPTED_EXT = /(\.pdf|\.csv|\.docx|\.doc|\.txt)$/i;
const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

const formatSize = (bytes) => {
  if (typeof bytes !== 'number') return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
};

export default function DocHelpAgent() {
  const fileInputRef = useRef(null);
  const [stage, setStage] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [currentFile, setCurrentFile] = useState(null); // { file: File, serverFilename?: string }
  const [chatEntries, setChatEntries] = useState([]); // { id, question, answer, status }
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);

  const resetToUpload = useCallback(() => {
    setStage('upload');
    setChatEntries([]);
    setQuestion('');
    setSending(false);
    setUploadError('');
    setCurrentFile(null);
  }, []);

  const onFileChange = useCallback(async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const validation = validateAttachment(file, { acceptRe: ACCEPTED_EXT, maxBytes: MAX_SIZE_BYTES });
    if (!validation.ok) {
      const message = validation.error === 'File too large'
        ? 'File too large. Max allowed size is 200MB.'
        : 'Only PDF/CSV/DOCX/DOC/TXT files are allowed.';
      setUploadError(message);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const uploadData = await uploadFile(file, { agent: DOCHELP_AGENT_ID });
      const serverFilename = resolveUploadedFilename(uploadData, file.name);
      setCurrentFile({ file, serverFilename });
      setStage('chat');
      setChatEntries([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Upload failed', err);
      const errText = err?.data?.error || err?.data?.message || err?.message || 'Upload failed, please try again.';
      setUploadError(String(errText));
    } finally {
      setUploading(false);
    }
  }, []);

  const onSubmitQuestion = async (event) => {
    event.preventDefault();
    if (sending) return;
    const trimmed = question.trim();
    if (!trimmed) return;

    const entryId = `chat-${Date.now()}`;
    setChatEntries((prev) => [
      ...prev,
      {
        id: entryId,
        question: trimmed,
        answer: '',
        status: 'pending',
      },
    ]);
    setQuestion('');
    setSending(true);

    try {
      const serverFilename = currentFile?.serverFilename || currentFile?.file?.name;
      const response = await queryAgent({
        input: trimmed,
        agent: DOCHELP_AGENT_ID,
        filename: serverFilename,
        payloadMode: 'minimal',
      });
      const answer = parseBotResponse(response);
      const referencedFiles = Array.isArray(response?.files)
        ? response.files.filter((f) => typeof f === 'string' && f.trim())
        : [];
      const answerWithContext = referencedFiles.length
        ? `${answer}\n\nFiles: ${referencedFiles.join(', ')}`
        : answer;
      setChatEntries((prev) => prev.map((entry) => (
        entry.id === entryId
          ? { ...entry, answer: answerWithContext, status: 'done' }
          : entry
      )));
    } catch (err) {
      console.error('Query failed', err);
      const errText = err?.data?.error || err?.data?.message || err?.message || 'Unable to fetch response.';
      setChatEntries((prev) => prev.map((entry) => (
        entry.id === entryId
          ? { ...entry, answer: String(errText), status: 'error' }
          : entry
      )));
    } finally {
      setSending(false);
    }
  };

  const uploadCard = useMemo(() => (
    <div className="flex h-full w-full items-center justify-center py-10">
      <div className="w-full max-w-xl rounded-2xl border border-dashed border-indigo-300 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-800">Upload a document</h1>
        <p className="mt-2 text-sm text-slate-500">
          DocHelp works best with PDF, Word, CSV, or text files up to 200 MB. Upload a file to start chatting about it.
        </p>
        <div className="mt-6">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/60 px-6 py-10 text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-100">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.doc,.docx,.txt"
              className="sr-only"
              onChange={onFileChange}
              disabled={uploading}
            />
            <span className="text-5xl">📄</span>
            <span className="text-base font-medium">
              {uploading ? 'Uploading…' : 'Select file or drag & drop'}
            </span>
            <span className="text-xs text-indigo-400">Accepted types: PDF, CSV, DOCX, DOC, TXT</span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Choose File'}
        </button>
        {uploadError && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {uploadError}
          </div>
        )}
      </div>
    </div>
  ), [uploadError, uploading, onFileChange]);

  const renderFileInfo = () => {
    if (!currentFile?.file) return null;
    const { file } = currentFile;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Current document</h2>
            <div className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-700">{file.name}</span>
              <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">{formatSize(file.size)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={resetToUpload}
            className="inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
          >
            Upload another file
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Responses reference only this document. Each question is handled independently.
        </p>
      </div>
    );
  };

  const renderChat = () => (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">DocHelp chat</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ask a question below. DocHelp answers without keeping prior context, so each turn stands alone.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-4">
        {chatEntries.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Your conversation will appear here.
          </div>
        )}
        {chatEntries.length > 0 && (
          <div className="space-y-4">
            {chatEntries.map((entry) => (
              <div key={entry.id} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-indigo-600 px-3 py-2 text-sm text-white shadow-sm">
                    {entry.question}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${entry.status === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-white text-slate-700'}`}>
                    {entry.status === 'pending' && (
                      <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
                        Waiting for response…
                      </span>
                    )}
                    {entry.status !== 'pending' && (
                      <span className="whitespace-pre-wrap">{entry.answer}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={onSubmitQuestion} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700" htmlFor="dochelp-question">
          Ask DocHelp about this document
        </label>
        <textarea
          id="dochelp-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How can I summarize this document?"
          className="h-24 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          disabled={sending}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-slate-400">Each reply is generated fresh—there's no chat history.</span>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
            disabled={sending || !question.trim()}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );

  if (stage === 'upload') {
    return (
      <div className="flex min-h-[70vh] flex-col px-4 py-6 sm:px-6 lg:px-8">
        {uploadCard}
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-1 text-slate-700">
        <h1 className="text-2xl font-semibold">DocHelp</h1>
        <p className="text-sm text-slate-500">
          Upload a document and chat asynchronously with DocHelp for insights, summaries, and answers.
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-6">
        {renderFileInfo()}
        {renderChat()}
      </div>
    </div>
  );
}
