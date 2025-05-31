import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import FootballPage from './pages/FootballPage'; // Import the FootballPage

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} /> {/* Route for stocks */}
        <Route path="/football/:roomId" element={<FootballPage />} /> {/* Route for football */}
      </Routes>
    </Router>
  );
};

export default App;