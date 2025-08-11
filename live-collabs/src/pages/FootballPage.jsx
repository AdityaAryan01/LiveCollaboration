import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import * as d3 from "d3";
import { io } from "socket.io-client";
import { AuthContext } from "../context/AuthContext.jsx";

import ArsenalLogo from "../assets/arsenal-logo.jpg";
import ChelseaLogo from "../assets/chelsea-logo.jpg";
import ManCityLogo from "../assets/manchester-city-logo.jpg";
import LiverpoolLogo from "../assets/liverpool-logo.jpg";
import ForestLogo from "../assets/nottingham-forest.png";

const colors = {
  Arsenal: "#EF0107",
  Chelsea: "#034694",
  "Manchester City": "#6CABDD",
  Liverpool: "#C8102E",
  "Nottingham Forest": "rgb(0, 0, 0)"
};

const logoPaths = {
  Arsenal: ArsenalLogo,
  Chelsea: ChelseaLogo,
  "Manchester City": ManCityLogo,
  Liverpool: LiverpoolLogo,
  "Nottingham Forest": ForestLogo
};
const socketURL =
  window.location.hostname === "localhost"
    ? "http://localhost:5001"
    : "https://livecollaboration.onrender.com";

const socket = io(socketURL, {
  withCredentials: true,
  transports: ["websocket", "polling"],
});

const FootballPage = () => {
  const { roomId } = useParams();
  const { user } = useContext(AuthContext);
  const [teamsData, setTeamsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [clientNames, setClientNames] = useState([]);
  const svgRef = useRef();

  const trimResults = (results) => {
    let lastValid = results.length - 1;
    while (lastValid >= 0 && !results[lastValid]) {
      lastValid--;
    }
    return results.slice(0, lastValid + 1);
  };

  useEffect(() => {
    if (roomId && user?.name) {
      socket.emit("joinFootballRoom", roomId);
      socket.emit("setUsername", { roomId, username: user.name, type: "football" });
      socket.emit("requestMatchResults", roomId);
    }
  }, [roomId, user]);

  useEffect(() => {
    socket.on("matchResults", (results) => {
      setTeamsData(results);
      setLoading(false);
    });

    socket.on("roomClients", (clients) => {
      setClientNames(clients);
    });

    socket.on("error", (error) => {
      console.error("WebSocket Error:", error);
      setLoading(false);
    });

    return () => {
      socket.off("matchResults");
      socket.off("roomClients");
    };
  }, []);

  const calculateCumulativePoints = (results) => {
    let cumulative = [0];
    results.forEach((result) => {
      cumulative.push(
        cumulative[cumulative.length - 1] + (result === "W" ? 3 : result === "D" ? 1 : 0)
      );
    });
    return cumulative;
  };

  useEffect(() => {
    if (!teamsData || Object.keys(teamsData).length === 0) return;

    const width = 1000;
    const height = 600;
    const margin = { top: 40, right: 200, bottom: 60, left: 60 };

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .html("");

    const teams = Object.keys(teamsData).sort();
    const trimmedData = {};
    const cumulativePoints = {};
    teams.forEach((team) => {
      const validResults = trimResults(teamsData[team]);
      trimmedData[team] = validResults;
      cumulativePoints[team] = calculateCumulativePoints(validResults);
    });

    const globalMatchdays = d3.max(teams.map((team) => cumulativePoints[team].length)) || 1;

    const rankingsPerTeam = {};
    teams.forEach((team) => {
      rankingsPerTeam[team] = [];
    });

    for (let i = 0; i < globalMatchdays; i++) {
      const dayPoints = teams.map((team) => ({
        team,
        points: cumulativePoints[team][i] !== undefined
          ? cumulativePoints[team][i]
          : cumulativePoints[team][cumulativePoints[team].length - 1]
      }));

      dayPoints.sort((a, b) => b.points - a.points || a.team.localeCompare(b.team));
      dayPoints.forEach((entry, index) => {
        rankingsPerTeam[entry.team].push(index + 1);
      });
    }

    const xScale = d3.scaleLinear()
      .domain([0, 38])
      .range([margin.left, width - margin.right]);

    const teamCount = teams.length;
    const yScale = d3.scaleLinear()
      .domain([teamCount + 1, 1])
      .range([height - margin.bottom, margin.top]);

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(39));

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(yScale)
          .tickValues(d3.range(1, teamCount + 1))
          .tickFormat((d) => `Rank ${d}`)
      );

    const line = d3.line()
      .x((d, i) => xScale(i))
      .y((d) => yScale(d));

    teams.forEach((team) => {
      const validLength = cumulativePoints[team].length;
      const validRankings = rankingsPerTeam[team].slice(0, validLength);

      const clipId = `clip-${team.replace(/\s+/g, "-")}`;
      svg.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", margin.left)
        .attr("y", 0)
        .attr("width", 0)
        .attr("height", height);

      svg.append("path")
        .datum(validRankings)
        .attr("fill", "none")
        .attr("stroke", colors[team])
        .attr("stroke-width", 2)
        .attr("clip-path", `url(#${clipId})`)
        .attr("d", line);

      if (validLength === 0) return;
      const initialRank = validRankings[0];
      const initialY = yScale(initialRank);

      const logo = svg.append("image")
        .attr("xlink:href", logoPaths[team])
        .attr("width", 40)
        .attr("height", 40)
        .attr("x", xScale(0) - 20)
        .attr("y", isNaN(initialY) ? 0 : initialY - 20);

      const clipRect = svg.select(`#${clipId} rect`);
      logo.transition()
        .duration(18000)
        .ease(d3.easeLinear)
        .tween("moveLogo", function () {
          return (t) => {
            const lastMatchDay = validRankings.length - 1;
            const animatedMatchday = t * lastMatchDay;
            const x = xScale(animatedMatchday);
            const i = Math.min(Math.floor(animatedMatchday), validRankings.length - 1);
            const fraction = Math.max(0, Math.min(animatedMatchday - i, 1));
            clipRect.attr("width", Math.max(0, x - margin.left));
            const rank1 = validRankings[i];
            const rank2 = validRankings[i + 1] || rank1;
            const interpolatedRank = rank1 + (rank2 - rank1) * fraction;
            const yPos = yScale(interpolatedRank);
            if (!isNaN(yPos)) {
              logo.attr("x", x - 20).attr("y", yPos - 20);
            }
          };
        });
    });

    const legend = svg.append("g")
      .attr("transform", `translate(${width - margin.right + 20},${margin.top})`);
    teams.forEach((team, i) => {
      const legendItem = legend.append("g")
        .attr("transform", `translate(0,${i * 30})`);
      legendItem.append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", colors[team]);
      legendItem.append("text")
        .attr("x", 30)
        .attr("y", 15)
        .text(team)
        .style("font-size", "14px")
        .style("fill", "#333");
    });
  }, [teamsData]);

  const containerStyle = {
    minHeight: "calc(100vh - 80px)",
    background: "linear-gradient(135deg, #1E3A8A 0%, #3730A3 50%, #1E40AF 100%)",
    padding: "20px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    position: "relative",
    overflow: "hidden"
  };

  const backgroundPattern = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundImage: `
      radial-gradient(circle at 25% 25%, rgba(34, 197, 94, 0.05) 0%, transparent 50%),
      radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
      linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
    `,
    backgroundSize: "400px 400px, 400px 400px, 30px 30px, 30px 30px",
    zIndex: 1
  };

  const contentStyle = {
    position: "relative",
    zIndex: 2,
    maxWidth: "1400px",
    margin: "0 auto"
  };

  const headerStyle = {
    textAlign: "center",
    marginBottom: "30px",
    padding: "30px",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "20px",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)"
  };

  const titleStyle = {
    fontSize: "2.5rem",
    fontWeight: "800",
    color: "white",
    marginBottom: "10px",
    textShadow: "0 4px 8px rgba(0,0,0,0.3)"
  };

  const roomInfoStyle = {
    display: "flex",
    justifyContent: "center",
    gap: "30px",
    flexWrap: "wrap",
    marginBottom: "20px"
  };

  const infoItemStyle = {
    background: "rgba(34, 197, 94, 0.2)",
    padding: "10px 20px",
    borderRadius: "25px",
    border: "1px solid rgba(34, 197, 94, 0.4)",
    color: "#22C55E",
    fontSize: "14px",
    fontWeight: "500"
  };

  const buttonStyle = {
    padding: "12px 24px",
    background: "rgba(34, 197, 94, 0.2)",
    border: "2px solid #22C55E",
    borderRadius: "12px",
    color: "#22C55E",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    backdropFilter: "blur(10px)"
  };

  const chartContainerStyle = {
    background: "rgba(255, 255, 255, 0.95)",
    borderRadius: "20px",
    padding: "30px",
    marginBottom: "30px",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    overflow: "auto"
  };

  const sidebarStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    marginBottom: "30px"
  };

  const cardStyle = {
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    padding: "25px",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)"
  };

  const cardTitleStyle = {
    fontSize: "1.2rem",
    fontWeight: "700",
    color: "white",
    marginBottom: "15px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  };

  const clientListStyle = {
    listStyle: "none",
    padding: 0,
    margin: 0
  };

  const clientItemStyle = {
    background: "rgba(34, 197, 94, 0.2)",
    padding: "8px 15px",
    borderRadius: "8px",
    marginBottom: "8px",
    color: "#22C55E",
    fontSize: "14px",
    fontWeight: "500",
    border: "1px solid rgba(34, 197, 94, 0.3)"
  };

  const resultsContainerStyle = {
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    padding: "25px",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)"
  };

  const teamResultStyle = {
    marginBottom: "20px",
    padding: "15px",
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)"
  };

  const teamNameStyle = {
    fontSize: "1.1rem",
    fontWeight: "700",
    color: "white",
    marginBottom: "10px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  };

  const resultsBadgeContainerStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px"
  };

  const getResultBadgeStyle = (result) => {
    const baseStyle = {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "600",
      minWidth: "20px",
      textAlign: "center"
    };

    if (result === "W") {
      return {
        ...baseStyle,
        background: "#22C55E",
        color: "white"
      };
    } else if (result === "D") {
      return {
        ...baseStyle,
        background: "#F59E0B",
        color: "white"
      };
    } else if (result === "L") {
      return {
        ...baseStyle,
        background: "#EF4444",
        color: "white"
      };
    } else {
      return {
        ...baseStyle,
        background: "rgba(255, 255, 255, 0.2)",
        color: "rgba(255, 255, 255, 0.7)"
      };
    }
  };

  if (loading) {
    return (
      <div style={{
        ...containerStyle,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "18px",
        color: "white"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "15px",
          background: "rgba(255, 255, 255, 0.1)",
          padding: "20px 40px",
          borderRadius: "16px",
          backdropFilter: "blur(10px)"
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            border: "3px solid rgba(255,255,255,0.3)",
            borderTop: "3px solid white",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          ⚽ Loading Premier League data...
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

  return (
    <div style={containerStyle}>
      <div style={backgroundPattern}></div>
      <div style={contentStyle}>
        <header style={headerStyle}>
          <h2 style={titleStyle}>⚽ Premier League Rankings Progression</h2>
          <div style={roomInfoStyle}>
            <div style={infoItemStyle}>
              <strong>Room:</strong> {roomId}
            </div>
            <div style={infoItemStyle}>
              <strong>Fan:</strong> {user?.name}
            </div>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(roomId)}
            style={buttonStyle}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(34, 197, 94, 0.3)";
              e.target.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(34, 197, 94, 0.2)";
              e.target.style.transform = "translateY(0)";
            }}
          >
            📋 Copy Room ID
          </button>
        </header>

        <div style={sidebarStyle}>
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              👥 Football Fans ({clientNames.length})
            </h3>
            {clientNames.length > 0 ? (
              <ul style={clientListStyle}>
                {clientNames.map((name, index) => (
                  <li key={index} style={clientItemStyle}>
                    {name || "Anonymous Fan"}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: "14px", margin: 0 }}>
                No fans connected yet
              </p>
            )}
          </div>
        </div>

        <div style={chartContainerStyle}>
          <svg ref={svgRef} style={{ width: "100%", height: "auto", minHeight: "600px" }}></svg>
        </div>

        <div style={resultsContainerStyle}>
          <h3 style={cardTitleStyle}>📊 Latest Match Results</h3>
          {Object.entries(teamsData).map(([team, results]) => (
            <div key={team} style={teamResultStyle}>
              <h4 style={teamNameStyle}>
                <span style={{
                  width: "16px",
                  height: "16px",
                  background: colors[team],
                  borderRadius: "50%",
                  display: "inline-block"
                }}></span>
                {team}
              </h4>
              <div style={resultsBadgeContainerStyle}>
                {results.map((result, index) => (
                  <span key={index} style={getResultBadgeStyle(result)}>
                    {result || "-"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FootballPage;