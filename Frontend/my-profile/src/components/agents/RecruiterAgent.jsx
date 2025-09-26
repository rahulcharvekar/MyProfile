import React, { useEffect, useMemo, useState } from 'react';
import { profileChatAgent, queryAgent } from '../../lib/apiClient';

const RECRUITER_AGENT_ID = 'recruiter';
const PAGE_SIZE = 5;

const formatScore = (score) => {
  if (score === undefined || score === null) return 'N/A';
  if (typeof score === 'number' && Number.isNaN(score)) return 'N/A';
  return String(score);
};

const buildCommentaryText = ({ query, recommendation }) => {
  const parts = [];
  if (query) parts.push(`Query\n${query}`);
  if (recommendation) parts.push(`Recommendation\n${recommendation}`);
  return parts.join('\n\n');
};

export default function RecruiterAgent() {
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [matches, setMatches] = useState([]);
  const [agentDetails, setAgentDetails] = useState({ query: '', recommendation: '' });
  const [sessionId, setSessionId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFile, setSelectedFile] = useState('');
  const [profileQuestion, setProfileQuestion] = useState('');
  const [profileSending, setProfileSending] = useState(false);
  const [qaEntries, setQaEntries] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));

  const pageMatches = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return matches.slice(start, start + PAGE_SIZE);
  }, [matches, currentPage]);

  const commentaryValue = buildCommentaryText(agentDetails);

  const activeMatch = useMemo(() => {
    if (!selectedFile) return null;
    return matches.find((match) => match.file === selectedFile) || null;
  }, [matches, selectedFile]);

  const qaForSelectedProfile = useMemo(() => {
    if (!selectedFile) return [];
    return qaEntries.filter((entry) => entry.file === selectedFile);
  }, [qaEntries, selectedFile]);

  useEffect(() => {
    if (!selectedFile) return;
    if (!matches.some((match) => match.file === selectedFile)) {
      setSelectedFile('');
      setIsModalOpen(false);
    }
  }, [matches, selectedFile]);

  const onSubmitSearch = async (event) => {
    event.preventDefault();
    if (!searchText.trim() || searching) return;

    setSearching(true);
    setSearchError('');

    try {
      const data = await queryAgent({
        input: searchText.trim(),
        agent: RECRUITER_AGENT_ID,
        sessionId,
      });

      const rawResponse = data?.response;
      let nextMatches = [];
      let nextQuery = '';
      let nextRecommendation = '';

      if (Array.isArray(rawResponse)) {
        nextMatches = rawResponse.map((entry, index) => {
          const rawFile = entry?.file || entry?.filename || entry?.document || entry?.document_name || entry?.resume || entry?.resume_name || entry?.name;
          const candidateName = entry?.candidate_name || entry?.name || rawFile;
          const derivedFile = rawFile || candidateName || `match-${index + 1}`;
          const score = typeof entry?.matching_score === 'number'
            ? entry.matching_score
            : typeof entry?.score === 'number'
              ? entry.score
              : null;
          const highlight = Array.isArray(entry?.highlights)
            ? entry.highlights.join('\n\n')
            : entry?.answer;
          return {
            file: derivedFile,
            candidate_name: candidateName || derivedFile,
            matching_score: score,
            highlight,
            raw: entry,
          };
        });
      } else if (rawResponse && typeof rawResponse === 'object') {
        const matchesFromObject = Array.isArray(rawResponse.matches) ? rawResponse.matches : [];
        nextMatches = matchesFromObject.map((entry, index) => {
          const rawFile = entry?.file || entry?.filename || entry?.document || entry?.document_name || entry?.resume || entry?.resume_name || entry?.name;
          const candidateName = entry?.candidate_name || entry?.name || rawFile;
          const derivedFile = rawFile || candidateName || `match-${index + 1}`;
          const score = typeof entry?.matching_score === 'number'
            ? entry.matching_score
            : typeof entry?.score === 'number'
              ? entry.score
              : null;
          const highlight = Array.isArray(entry?.highlights)
            ? entry.highlights.join('\n\n')
            : entry?.highlight || entry?.answer;
          return {
            file: derivedFile,
            candidate_name: candidateName || derivedFile,
            matching_score: score,
            highlight,
            raw: entry,
          };
        });
        nextQuery = rawResponse.query || '';
        nextRecommendation = rawResponse.recommendation || '';
      } else if (typeof rawResponse === 'string') {
        nextRecommendation = rawResponse;
      }

      setMatches(nextMatches);
      setAgentDetails({
        query: nextQuery,
        recommendation: nextRecommendation,
      });
      const nextSessionId = data?.session_id || data?.sessionId || '';
      setSessionId(nextSessionId);
      setCurrentPage(1);
      setSelectedFile('');
      setIsModalOpen(false);
      setQaEntries((prev) => prev.filter((entry) => nextMatches.some((item) => item?.file === entry.file)));
    } catch (err) {
      console.error('Recruiter search failed', err);
      const errText = err?.data?.error || err?.data?.message || err?.message || 'Unable to search candidates.';
      setSearchError(String(errText));
    } finally {
      setSearching(false);
    }
  };

  const onOpenProfile = (match) => {
    if (!match?.file) return;
    setSelectedFile(match.file);
    setProfileQuestion('');
    setIsModalOpen(true);
  };

  const onCloseModal = () => {
    setIsModalOpen(false);
    setProfileQuestion('');
  };

  const onAskProfileQuestion = async (event) => {
    event.preventDefault();
    if (!activeMatch || profileSending) return;
    const trimmed = profileQuestion.trim();
    if (!trimmed) return;

    const entryId = `qa-${Date.now()}`;
    setProfileQuestion('');
    setProfileSending(true);
    setQaEntries((prev) => ([
      ...prev,
      {
        id: entryId,
        file: activeMatch.file,
        question: trimmed,
        answer: '',
        status: 'pending',
      },
    ]));

    try {
      const response = await profileChatAgent({
        query: trimmed,
        agent: RECRUITER_AGENT_ID,
        filename: activeMatch.file,
        sessionId,
        extraTools: [],
      });
      let answer;
      if (typeof response?.response === 'string') {
        answer = response.response;
      } else if (response?.response && typeof response.response === 'object') {
        try {
          answer = JSON.stringify(response.response, null, 2);
        } catch {
          answer = String(response.response);
        }
      } else {
        answer = response?.response !== undefined ? String(response.response) : '✅ Done.';
      }
      if (response?.session_id) setSessionId(response.session_id);
      setQaEntries((prev) => prev.map((entry) => (
        entry.id === entryId
          ? { ...entry, answer, status: 'done' }
          : entry
      )));
    } catch (err) {
      console.error('Recruiter follow-up failed', err);
      const errText = err?.data?.error || err?.data?.message || err?.message || 'Unable to get a response.';
      setQaEntries((prev) => prev.map((entry) => (
        entry.id === entryId
          ? { ...entry, answer: String(errText), status: 'error' }
          : entry
      )));
    } finally {
      setProfileSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-slate-50 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-800">Recruiter Agent</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search for profiles with natural language or keyword queries. Results rank candidates by match score.
        </p>
        <form onSubmit={onSubmitSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="e.g. Senior cloud architect with Java and Azure experience"
            className="w-full flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={searching}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
            disabled={searching}
          >
            {searching ? 'Searching…' : 'Search profiles'}
          </button>
        </form>
        {searchError && (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {searchError}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Matched profiles</h2>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {matches.length} result{matches.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {matches.length === 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Run a search to see candidate matches.
              </div>
            )}
            {pageMatches.map((match) => (
              <div
                key={match.file || match.candidate_name}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {match.file || match.candidate_name}
                  </div>
                  {match.candidate_name && match.candidate_name !== match.file && (
                    <div className="truncate text-xs text-slate-500">{match.candidate_name}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-md bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                    {formatScore(match.matching_score)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenProfile(match)}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    Know more
                  </button>
                </div>
              </div>
            ))}
          </div>
          {matches.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="text-xs font-medium text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">General commentary</h2>
          <textarea
            className="mt-2 h-32 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:outline-none"
            value={commentaryValue}
            readOnly
          />
        </div>
      </div>

      {isModalOpen && activeMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-slate-800">{activeMatch.candidate_name || activeMatch.file}</span>
                <span className="text-xs text-slate-500 break-all">{activeMatch.file}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                  {formatScore(activeMatch.matching_score)}
                </span>
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
              {activeMatch.highlight && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Highlight</div>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed">
                    {activeMatch.highlight}
                  </p>
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                {qaForSelectedProfile.length === 0 && (
                  <p className="text-xs text-slate-400">No conversation yet. Ask the recruiter agent about this profile.</p>
                )}
                {qaForSelectedProfile.map((entry) => (
                  <div key={entry.id} className="rounded-md bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">You</div>
                    <p className="mt-1 text-sm text-slate-700">{entry.question}</p>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Agent</div>
                    <p className={`mt-1 text-sm ${entry.status === 'error' ? 'text-rose-600' : 'text-slate-700'}`}>
                      {entry.answer || (entry.status === 'pending' ? 'Thinking…' : '')}
                    </p>
                  </div>
                ))}
              </div>

              <form onSubmit={onAskProfileQuestion} className="flex flex-col gap-3">
                <textarea
                  value={profileQuestion}
                  onChange={(event) => setProfileQuestion(event.target.value)}
                  placeholder="Ask about this candidate's experience, skills, or fit"
                  className="min-h-[90px] resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  disabled={profileSending}
                />
                <button
                  type="submit"
                  className="self-end rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
                  disabled={profileSending}
                >
                  {profileSending ? 'Sending…' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
