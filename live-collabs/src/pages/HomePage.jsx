import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const HomePage = () => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('stocks'); // Default topic
  const [joinRoomId, setJoinRoomId] = useState('');

  const handleCreateRoom = () => {
    if (roomName.trim()) {
      const roomId = uuidv4(); // Generate a unique room ID
      if (selectedTopic === 'stocks') {
        navigate(`/room/${roomId}`);
      } else if (selectedTopic === 'football') {
        navigate(`/football/${roomId}`);
      }
    }
  };

  const handleJoinRoom = () => {
    if (joinRoomId.trim()) {
      if (selectedTopic === 'stocks') {
        navigate(`/room/${joinRoomId}`);
      } else if (selectedTopic === 'football') {
        navigate(`/football/${joinRoomId}`);
      }
    }
  };

  return (
    <div className="homepage">
      <h1>Live Collaboration</h1>
      <div className="room-creation">
        <h2>Create Room</h2>
        <input
          type="text"
          placeholder="Enter Room Name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
        <select
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
        >
          <option value="stocks">Stocks</option>
          <option value="football">Football</option>
        </select>
        <button onClick={handleCreateRoom}>Create Room</button>
      </div>
      <hr />
      <div className="room-join">
        <h2>Join Room</h2>
        <input
          type="text"
          placeholder="Enter Room ID"
          value={joinRoomId}
          onChange={(e) => setJoinRoomId(e.target.value)}
        />
        <select
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
        >
          <option value="stocks">Stocks</option>
          <option value="football">Football</option>
        </select>
        <button onClick={handleJoinRoom}>Join Room</button>
      </div>
    </div>
  );
};

export default HomePage;
