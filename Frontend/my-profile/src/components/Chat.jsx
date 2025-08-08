import React, { useState, useEffect, useRef } from 'react';

const apiURL = import.meta.env.VITE_API_URL;


const Chat = () => {
  const [input, setInput] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false); 

  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: '👋 Hi! You can ask a question or upload a file to get started.',
      type: 'text',
    },
    {
      sender: 'bot',
      text: '📁 Please upload a file:',
      type: 'upload',
    },
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { text: trimmed, sender: 'user', type: 'text' }]);
    setInput('');

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { text: data.response, sender: 'bot', type: 'text' }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { text: '❌ Error: Unable to reach server.', sender: 'bot', type: 'text' },
      ]);
    }
  };

  const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // File too large
  if (file.size > 200 * 1024 * 1024) {
    setMessages((prev) => [
      ...prev,
      { text: '❌ File too large. Max allowed size is 200MB.', sender: 'bot', type: 'text' },
    ]);
    return;
  }

  // Prevent uploading a different file if a file was uploaded successfully
  if (uploadSuccess && uploadedFileName !== file.name) {
    setMessages((prev) => [
      ...prev,
      {
        text: `⚠️ You already uploaded "${uploadedFileName}". Only that file can be re-uploaded in this session.`,
        sender: 'bot',
        type: 'text',
      },
    ]);
    return;
  }

  // Show file upload in chat
  setMessages((prev) => [
    ...prev,
    { text: `📎 You uploaded: ${file.name}`, sender: 'user', type: 'text' },
    { text: '🧠 Typing...', sender: 'bot', type: 'typing' },
  ]);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(apiURL, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    setTimeout(() => {
      setMessages((prev) => {
        const updated = [...prev];
        updated.pop(); // remove "Typing..."
        return [...updated, { text: data.response, sender: 'bot', type: 'text' }];
      });

      // ✅ Mark success and track filename
      setUploadedFileName(file.name);
      setUploadSuccess(true);
    }, 1500);
  } catch {
    setMessages((prev) => {
      const updated = [...prev];
      updated.pop(); // remove typing
      return [
        ...updated,
        { text: '❌ Error uploading file.', sender: 'bot', type: 'text' },
      ];
    });

    // ❌ Don't lock upload on failure
    setUploadSuccess(false);
  }
};


  return (
    <div className="h-full flex flex-col items-center bg-gray-100 px-2 py-4">
      <div className="w-full max-w-2xl bg-white rounded shadow-lg flex flex-col h-full">
        {/* Header */}
        <div className="bg-black text-white p-4 rounded-t flex-shrink-0">
          <h2 className="text-xl font-semibold">Chatbot</h2>
          <p className="text-sm text-gray-300">Talk to our assistant</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.type === 'upload' ? (
                <div className="bg-gray-200 text-gray-900 text-sm rounded-lg px-4 py-2 max-w-[70%]">
                  <p className="mb-1">{msg.text}</p>
                  <input
  type="file"
  accept=".txt,.csv,.pdf"
  onChange={handleFileUpload}
  disabled={uploadSuccess}
  className="text-sm text-gray-700 file:mr-4 file:py-1 file:px-3 file:rounded file:border file:border-gray-300 file:bg-white file:text-gray-700 hover:file:bg-gray-100 disabled:opacity-50"
/>

{uploadSuccess && (
  <p className="text-xs mt-1 text-gray-600 italic">
    ✅ Upload completed: <strong>{uploadedFileName}</strong>
  </p>
)}

                </div>
              ) : (
                <div
                  className={`px-4 py-2 rounded-lg text-sm max-w-[70%] break-words ${
                    msg.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  {msg.text}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="flex border-t border-gray-200 p-3 bg-white rounded-b flex-shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none text-sm"
            placeholder="Type your message..."
          />
          <button
            type="submit"
            className="bg-black text-white px-6 rounded-r-md hover:bg-gray-800"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
