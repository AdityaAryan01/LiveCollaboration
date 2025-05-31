import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as d3 from "d3";
import { io } from "socket.io-client";

// Import logo images
import ArsenalLogo from "../assets/arsenal-logo.jpg";
import ChelseaLogo from "../assets/chelsea-logo.jpg";
import ManCityLogo from "../assets/manchester-city-logo.jpg";
import LiverpoolLogo from "../assets/liverpool-logo.jpg";
import ForestLogo from "../assets/nottingham-forest.png";

// Team colors and logos
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

const FootballPage = () => {
  const { roomId } = useParams();
  const [teamsData, setTeamsData] = useState({});
  const [loading, setLoading] = useState(true);
  const svgRef = useRef();
  const socketRef = useRef();

  const trimResults = (results) => {
    let lastValid = results.length - 1;
    while (lastValid >= 0 && !results[lastValid]) {
      lastValid--;
    }
    return results.slice(0, lastValid + 1);
  };

  useEffect(() => {
    socketRef.current = io("http://localhost:5001", {
      transports: ["websocket", "polling"],
      withCredentials: true
    });

    socketRef.current.on("connect", () => {
      socketRef.current.emit("requestMatchResults", roomId);
    });

    socketRef.current.on("matchResults", (results) => {
      setTeamsData(results);
      setLoading(false);
    });

    socketRef.current.on("error", (error) => {
      console.error("WebSocket Error:", error);
      setLoading(false);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [roomId]);

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
      // Create unique clip path ID
      const clipId = `clip-${team.replace(/\s+/g, "-")}`;
      
      // Add clip path
      svg.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", margin.left)
        .attr("y", 0)
        .attr("width", 0)
        .attr("height", height);

      // Draw line with clipping
      svg.append("path")
        .datum(validRankings)
        .attr("class", `team-line ${team.replace(/\s+/g, "-")}`)
        .attr("fill", "none")
        .attr("stroke", colors[team])
        .attr("stroke-width", 2)
        .attr("clip-path", `url(#${clipId})`)
        .attr("d", line);

      // Logo animation
      const fullRankings = rankingsPerTeam[team];
      if (validLength === 0) return;
      const initialRank = validRankings[0];
      const initialY = yScale(initialRank);

      const logo = svg.append("image")
        .attr("class", `team-logo ${team.replace(/\s+/g, "-")}`)
        .attr("xlink:href", logoPaths[team])
        .attr("width", 40)
        .attr("height", 40)
        .attr("x", xScale(0) - 20)
        .attr("y", isNaN(initialY) ? 0 : initialY - 20);

      // Get reference to clip path rectangle
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

            // Update clip path width
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

    // Legend
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

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h2>Premier League Rankings Progression - Room {roomId}</h2>
      {loading ? (
        <div>Loading match data...</div>
      ) : (
        <>
          <svg ref={svgRef}></svg>
          <div style={{ marginTop: "20px" }}>
            <h3>Latest Results:</h3>
            {Object.entries(teamsData).map(([team, results]) => (
              <div key={team} style={{ marginBottom: "20px" }}>
                <h4>{team}</h4>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {results.map((result, index) => (
                    <li key={index} style={{ display: "inline-block", margin: "0 5px" }}>
                      {result}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default FootballPage;