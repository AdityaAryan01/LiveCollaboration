import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { useNavigate, Link } from "react-router-dom";

export default function RegisterPage() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    minHeight: "calc(100vh - 80px)",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  };

  const cardStyle = {
    background: "rgba(255, 255, 255, 0.95)",
    borderRadius: "20px",
    padding: "50px",
    width: "100%",
    maxWidth: "450px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.2)"
  };

  const titleStyle = {
    fontSize: "2.5rem",
    fontWeight: "800",
    color: "#2D3748",
    textAlign: "center",
    marginBottom: "10px",
    letterSpacing: "-0.02em"
  };

  const subtitleStyle = {
    fontSize: "1rem",
    color: "#718096",
    textAlign: "center",
    marginBottom: "40px",
    fontWeight: "400"
  };

  const formGroupStyle = {
    marginBottom: "25px"
  };

  const labelStyle = {
    display: "block",
    fontSize: "14px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "8px",
    letterSpacing: "0.025em"
  };

  const inputStyle = {
    width: "100%",
    padding: "15px 20px",
    borderRadius: "12px",
    border: "2px solid #E5E7EB",
    fontSize: "16px",
    outline: "none",
    transition: "all 0.3s ease",
    boxSizing: "border-box",
    background: "#FAFAFA"
  };

  const buttonStyle = {
    width: "100%",
    padding: "15px 30px",
    background: loading 
      ? "linear-gradient(135deg, #9CA3AF 0%, #9CA3AF 100%)"
      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: loading ? "not-allowed" : "pointer",
    transition: "all 0.3s ease",
    boxShadow: loading 
      ? "0 4px 15px rgba(156, 163, 175, 0.4)"
      : "0 4px 15px rgba(102, 126, 234, 0.4)",
    marginTop: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px"
  };

  const errorStyle = {
    background: "rgba(239, 68, 68, 0.1)",
    border: "2px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "12px",
    padding: "15px",
    marginBottom: "25px",
    color: "#DC2626",
    fontSize: "14px",
    fontWeight: "500",
    textAlign: "center"
  };

  const linkContainerStyle = {
    textAlign: "center",
    marginTop: "30px",
    paddingTop: "25px",
    borderTop: "1px solid #E5E7EB",
    color: "#6B7280",
    fontSize: "14px"
  };

  const linkStyle = {
    color: "#667eea",
    textDecoration: "none",
    fontWeight: "600",
    marginLeft: "5px",
    transition: "all 0.3s ease"
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>Create Account</h2>
        <p style={subtitleStyle}>Join us to start collaborating</p>
        
        {error && (
          <div style={errorStyle}>
            🚨 {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="Enter your full name"
              required
              disabled={loading}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                e.target.style.background = "white";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E5E7EB";
                e.target.style.boxShadow = "none";
                e.target.style.background = "#FAFAFA";
              }}
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="Enter your email"
              required
              disabled={loading}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                e.target.style.background = "white";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E5E7EB";
                e.target.style.boxShadow = "none";
                e.target.style.background = "#FAFAFA";
              }}
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="Create a password"
              required
              disabled={loading}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                e.target.style.background = "white";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#E5E7EB";
                e.target.style.boxShadow = "none";
                e.target.style.background = "#FAFAFA";
              }}
            />
          </div>

          <button 
            type="submit" 
            style={buttonStyle}
            disabled={loading}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.6)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
              }
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: "20px",
                  height: "20px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTop: "2px solid white",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}></div>
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div style={linkContainerStyle}>
          Already have an account?
          <Link 
            to="/login" 
            style={linkStyle}
            onMouseEnter={(e) => {
              e.target.style.textDecoration = "underline";
            }}
            onMouseLeave={(e) => {
              e.target.style.textDecoration = "none";
            }}
          >
            Sign in here
          </Link>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}