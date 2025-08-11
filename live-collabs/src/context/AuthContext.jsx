import { createContext, useState, useEffect } from "react";
import axios from "axios";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Always send cookies with requests
  axios.defaults.withCredentials = true;

  // Auto-fetch current user if cookie exists
  useEffect(() => {
    axios
      .get("/api/users/profile")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await axios.post("/api/users/auth", { email, password });
    
    // Save token for Socket.IO use
    if (res.data?.token) {
      localStorage.setItem("socketToken", res.data.token);
    }

    // Fetch user profile (cookie-based)
    const profileRes = await axios.get("/api/users/profile");
    setUser(profileRes.data);
  };

  const register = async (name, email, password) => {
    const res = await axios.post("/api/users", { name, email, password });

    // Save token for Socket.IO use
    if (res.data?.token) {
      localStorage.setItem("socketToken", res.data.token);
    }

    // Fetch user profile (cookie-based)
    const profileRes = await axios.get("/api/users/profile");
    setUser(profileRes.data);
  };

  const logout = async () => {
    await axios.post("/api/users/logout");
    localStorage.removeItem("socketToken"); // remove stored token for sockets
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
