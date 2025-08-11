import React, { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import { AuthContext } from "./context/AuthContext.jsx";

import HomePage from "./pages/HomePage.jsx";
import RoomPage from "./pages/RoomPage.jsx";
import FootballPage from "./pages/FootballPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

export default function App() {
  const { user, logout, loading } = useContext(AuthContext);

  // Protected Route Wrapper
  const PrivateRoute = ({ children }) => {
    if (loading) {
      return (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          fontSize: "18px"
        }}>
          Loading...
        </div>
      );
    }
    return user ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <div style={{ minHeight: "100vh", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <header style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "15px 30px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          position: "sticky",
          top: 0,
          zIndex: 1000
        }}>
          <nav style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "1200px",
            margin: "0 auto"
          }}>
            <div>
              <Link to="/" style={{
                color: "white",
                textDecoration: "none",
                fontSize: "24px",
                fontWeight: "bold",
                textShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}>
                LiveCollab
              </Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              {user ? (
                <>
                  <span style={{
                    color: "white",
                    fontSize: "16px",
                    opacity: 0.9
                  }}>
                    Welcome, {user.name}
                  </span>
                  <button
                    onClick={logout}
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      border: "2px solid rgba(255,255,255,0.3)",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      transition: "all 0.3s ease",
                      backdropFilter: "blur(10px)"
                    }}
                    onMouseOver={(e) => {
                      e.target.style.background = "rgba(255,255,255,0.3)";
                      e.target.style.transform = "translateY(-2px)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.background = "rgba(255,255,255,0.2)";
                      e.target.style.transform = "translateY(0)";
                    }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" style={{
                    color: "white",
                    textDecoration: "none",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    background: "rgba(255,255,255,0.1)",
                    border: "2px solid rgba(255,255,255,0.2)",
                    transition: "all 0.3s ease",
                    fontSize: "14px",
                    fontWeight: "500"
                  }}>
                    Login
                  </Link>
                  <Link to="/register" style={{
                    color: "#667eea",
                    textDecoration: "none",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    background: "white",
                    border: "2px solid white",
                    transition: "all 0.3s ease",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}>
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/room/:roomId"
            element={
              <PrivateRoute>
                <RoomPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/football/:roomId"
            element={
              <PrivateRoute>
                <FootballPage />
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </div>
    </Router>
  );
}