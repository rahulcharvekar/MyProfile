import React, { useState, useEffect } from 'react';

function Contact() {
  const [message, setMessage] = useState('');
  const apiUrl = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetch(apiUrl)
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(error => console.error('Error:', error));
  }, []);

  return (
    <div>
      {message && <p>Python API says: {message}</p>}
    </div>
  );
}

export default Contact;