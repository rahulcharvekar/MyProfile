import React, { useRef, useState } from 'react';
import AttachButton from './AttachButton';
import CommandSelector from './CommandSelector';

export default function Composer({ isUploadDisabled, agentCommands = [], onFileSelected, onSend }) {
  const [input, setInput] = useState('');
  const [selectedCommand, setSelectedCommand] = useState('');
  const textInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const onAttachClick = () => {
    if (isUploadDisabled) return;
    fileInputRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (file) onFileSelected?.(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setInput('');
    setSelectedCommand('');
  };

  const handleCommandChange = (v) => {
    setSelectedCommand(v);
    if (v) {
      setInput(`${v} `);
      setTimeout(() => textInputRef.current?.focus(), 0);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <AttachButton onClick={onAttachClick} disabled={isUploadDisabled} />
      {!isUploadDisabled && (
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv" className="hidden" onChange={onFileChange} />
      )}
      <CommandSelector commands={agentCommands} value={selectedCommand} onChange={handleCommandChange} />
      <input
        ref={textInputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Write your message!"
        className="flex-1 focus:outline-none focus:placeholder-gray-400 text-gray-700 placeholder-gray-600 bg-white rounded-md py-3 px-3"
        aria-label="Message input"
      />
      <button type="submit" className="inline-flex items-center justify-center rounded-lg px-4 py-3 text-white bg-blue-500 hover:bg-blue-400">
        <span className="font-bold">Send</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 ml-2 transform rotate-90">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
      </button>
    </form>
  );
}

