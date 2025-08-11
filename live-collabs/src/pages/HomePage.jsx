import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { AuthContext } from "../context/AuthContext.jsx";
import { Link } from 'react-router-dom'; 

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [roomName, setRoomName] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("stocks");
  const [joinRoomId, setJoinRoomId] = useState("");

  const ensureAuth = () => {
    if (!user) {
      navigate("/login");
      return false;
    }
    return true;
  };

  const handleCreateRoom = () => {
    if (!ensureAuth()) return;
    if (roomName.trim()) {
      const roomId = uuidv4();
      if (selectedTopic === "stocks") {
        navigate(`/room/${roomId}`);
      } else if (selectedTopic === "football") {
        navigate(`/football/${roomId}`);
      }
    }
  };

  const handleJoinRoom = () => {
    if (!ensureAuth()) return;
    if (joinRoomId.trim()) {
      if (selectedTopic === "stocks") {
        navigate(`/room/${joinRoomId}`);
      } else if (selectedTopic === "football") {
        navigate(`/football/${joinRoomId}`);
      }
    }
  };

  const containerStyle = {
    minHeight: "calc(100vh - 80px)",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "40px 20px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  };

  const contentStyle = {
    maxWidth: "900px",
    margin: "0 auto",
    textAlign: "center"
  };

  const titleStyle = {
    fontSize: "3.5rem",
    fontWeight: "800",
    color: "white",
    marginBottom: "20px",
    textShadow: "0 4px 8px rgba(0,0,0,0.3)",
    letterSpacing: "-0.02em"
  };

  const subtitleStyle = {
    fontSize: "1.2rem",
    color: "rgba(255,255,255,0.9)",
    marginBottom: "50px",
    fontWeight: "300",
    lineHeight: "1.6"
  };

  const cardContainerStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: "30px",
    marginTop: "40px"
  };

  const cardStyle = {
    background: "rgba(255, 255, 255, 0.95)",
    borderRadius: "20px",
    padding: "40px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.2)",
    transition: "all 0.3s ease"
  };

  const cardTitleStyle = {
    fontSize: "1.8rem",
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: "30px",
    textAlign: "center"
  };

  const inputStyle = {
    width: "100%",
    padding: "15px 20px",
    borderRadius: "12px",
    border: "2px solid #E2E8F0",
    fontSize: "16px",
    marginBottom: "20px",
    outline: "none",
    transition: "all 0.3s ease",
    boxSizing: "border-box"
  };

  const selectStyle = {
    ...inputStyle,
    background: "white",
    cursor: "pointer"
  };

  const buttonStyle = {
    width: "100%",
    padding: "15px 30px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
    marginTop: "10px"
  };

  const warningStyle = {
    background: "rgba(239, 68, 68, 0.1)",
    border: "2px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "30px",
    color: "#DC2626",
    fontSize: "16px",
    fontWeight: "500"
  };

  const linkStyle = {
    color: "#667eea",
    textDecoration: "none",
    fontWeight: "600",
    padding: "2px 6px",
    borderRadius: "6px",
    background: "rgba(102, 126, 234, 0.1)",
    transition: "all 0.3s ease"
  };

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <h1 style={titleStyle}>Live Collaboration Hub</h1>
        <p style={subtitleStyle}>
          Create or join real-time collaborative rooms for stocks analysis and football rankings
        </p>

        {!user && (
          <div style={warningStyle}>
            🔒 You must{' '}
            <Link to="/login" style={linkStyle}>log in</Link>
            {' '}or{' '}
            <Link to="/register" style={linkStyle}>register</Link>
            {' '}to create or join a room.
          </div>
        )}

        <div style={cardContainerStyle}>
          <div 
            style={cardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.boxShadow = "0 25px 50px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.1)";
            }}
          >
            <h2 style={cardTitleStyle}>🚀 Create New Room</h2>
            <input
              type="text"
              placeholder="Enter room name..."
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E2E8F0";
                e.target.style.boxShadow = "none";
              }}
            />
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              style={selectStyle}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E2E8F0";
                e.target.style.boxShadow = "none";
              }}
            >
              <option value="stocks">📈 Stocks Analysis</option>
              <option value="football">⚽ Football Rankings</option>
            </select>
            <button 
              onClick={handleCreateRoom}
              style={buttonStyle}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
              }}
            >
              Create Room
            </button>
          </div>

          <div 
            style={cardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.boxShadow = "0 25px 50px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.1)";
            }}
          >
            <h2 style={cardTitleStyle}>🔗 Join Existing Room</h2>
            <input
              type="text"
              placeholder="Enter room ID..."
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E2E8F0";
                e.target.style.boxShadow = "none";
              }}
            />
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              style={selectStyle}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E2E8F0";
                e.target.style.boxShadow = "none";
              }}
            >
              <option value="stocks">📈 Stocks Analysis</option>
              <option value="football">⚽ Football Rankings</option>
            </select>
            <button 
              onClick={handleJoinRoom}
              style={buttonStyle}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
              }}
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;