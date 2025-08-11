import React, { useEffect, useRef, useState, useContext } from "react";
import * as d3 from "d3";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

const socketURL =
  window.location.hostname === "localhost"
    ? "http://localhost:5001"
    : "https://livecollaboration.onrender.com";

const socket = io(socketURL, {
  withCredentials: true,
  transports: ["websocket", "polling"],
});

const companies = [
  { name: "IBM (US)", symbol: "IBM" },
  { name: "Tesco (UK)", symbol: "TSCO.LON" },
  { name: "Shopify (Canada)", symbol: "SHOP.TRT" },
  { name: "Reliance (India)", symbol: "RELIANCE.BSE" },
  { name: "Volkswagen (Germany)", symbol: "MBG.DEX" },
  { name: "SAIC Motor (China)", symbol: "600104.SHH" },
];

const RoomPage = () => {
  const { roomId } = useParams();
  const { user } = useContext(AuthContext);
  const [data, setData] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [clientNames, setClientNames] = useState([]);
  const svgRef = useRef();
  const tooltipRef = useRef();
  const parseDate = d3.timeParse("%Y-%m-%d");

  useEffect(() => {
    if (roomId && user?.name) {
      socket.emit("joinStockRoom", roomId);
      socket.emit("setUsername", { roomId, username: user.name, type: "stock" });
    }
  }, [roomId, user]);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to WebSocket server on port 5001");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
    });

    socket.on("stockUpdate", (newData) => {
      console.log("Received stock data:", newData);
      setData(newData);
    });

    socket.on("roomClients", (clients) => {
      console.log("Updated room clients:", clients);
      setClientNames(clients);
    });

    return () => {
      socket.off("stockUpdate");
      socket.off("roomClients");
    };
  }, []);

  useEffect(() => {
    if (selectedCompany && roomId) {
      console.log("Selected company:", selectedCompany);
      socket.emit("updateSymbol", { symbol: selectedCompany.symbol, roomId });
    }
  }, [selectedCompany, roomId]);

  useEffect(() => {
    if (data.length === 0) {
      console.log("No data available to render.");
      return;
    }

    const isValid = data.every(
      (d) => !isNaN(parseDate(d.date)) && typeof d.close === "number"
    );

    if (!isValid) {
      console.error("Invalid data format:", data);
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => parseDate(d.date)))
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([
        d3.min(data, (d) => d.low) * 0.95,
        d3.max(data, (d) => d.high) * 1.05,
      ])
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line()
      .x((d) => xScale(parseDate(d.date)))
      .y((d) => yScale(d.close))
      .curve(d3.curveMonotoneX);

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(5));

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#10B981")
      .attr("stroke-width", 2)
      .attr("d", line);

    const hoverArea = svg
      .append("rect")
      .attr("width", width - margin.left - margin.right)
      .attr("height", height - margin.top - margin.bottom)
      .attr("transform", `translate(${margin.left},${margin.top})`)
      .style("fill", "none")
      .style("pointer-events", "all");

    const hoverDot = svg
      .append("circle")
      .attr("r", 4)
      .attr("fill", "#EF4444")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("opacity", 0);

    hoverArea
      .on("mousemove", (event) => {
        const [x] = d3.pointer(event);
        const bisectDate = d3.bisector((d) => parseDate(d.date)).left;
        const xValue = xScale.invert(x);
        const index = bisectDate(data, xValue, 0, data.length - 1);
        const closestDataPoint = data[index];

        hoverDot
          .attr("cx", xScale(parseDate(closestDataPoint.date)))
          .attr("cy", yScale(closestDataPoint.close))
          .style("opacity", 1);

        const tooltip = d3.select(tooltipRef.current);
        tooltip
          .style("display", "block")
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 30}px`)
          .html(`
            <div style="font-weight: 600; margin-bottom: 8px; color: #1F2937;">${closestDataPoint.date}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
              <div><span style="color: #6B7280;">Open:</span> <span style="color: #1F2937; font-weight: 500;">$${closestDataPoint.open}</span></div>
              <div><span style="color: #6B7280;">High:</span> <span style="color: #10B981; font-weight: 500;">$${closestDataPoint.high}</span></div>
              <div><span style="color: #6B7280;">Low:</span> <span style="color: #EF4444; font-weight: 500;">$${closestDataPoint.low}</span></div>
              <div><span style="color: #6B7280;">Close:</span> <span style="color: #1F2937; font-weight: 600;">$${closestDataPoint.close}</span></div>
            </div>
          `);
      })
      .on("mouseout", () => {
        hoverDot.style("opacity", 0);
        d3.select(tooltipRef.current).style("display", "none");
      });
  }, [data]);

  const containerStyle = {
    minHeight: "calc(100vh - 80px)",
    background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)",
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
      linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)
    `,
    backgroundSize: "50px 50px",
    zIndex: 1
  };

  const contentStyle = {
    position: "relative",
    zIndex: 2,
    maxWidth: "1200px",
    margin: "0 auto"
  };

  const headerStyle = {
    textAlign: "center",
    marginBottom: "40px",
    padding: "30px",
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "20px",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.1)"
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
    background: "rgba(16, 185, 129, 0.1)",
    padding: "10px 20px",
    borderRadius: "25px",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    color: "#10B981",
    fontSize: "14px",
    fontWeight: "500"
  };

  const controlsStyle = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "15px",
    marginBottom: "30px",
    flexWrap: "wrap"
  };

  const selectStyle = {
    padding: "12px 20px",
    borderRadius: "12px",
    border: "2px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.1)",
    color: "white",
    fontSize: "16px",
    fontWeight: "500",
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    outline: "none",
    minWidth: "250px"
  };

  const buttonStyle = {
    padding: "12px 24px",
    background: "rgba(16, 185, 129, 0.2)",
    border: "2px solid #10B981",
    borderRadius: "12px",
    color: "#10B981",
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
    border: "1px solid rgba(255, 255, 255, 0.2)"
  };

  const sidebarStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    marginTop: "20px"
  };

  const clientsCardStyle = {
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
    background: "rgba(16, 185, 129, 0.1)",
    padding: "8px 15px",
    borderRadius: "8px",
    marginBottom: "8px",
    color: "#10B981",
    fontSize: "14px",
    fontWeight: "500",
    border: "1px solid rgba(16, 185, 129, 0.2)"
  };

  return (
    <div style={containerStyle}>
      <div style={backgroundPattern}></div>
      <div style={contentStyle}>
        <header style={headerStyle}>
          <h2 style={titleStyle}>
            📈 {selectedCompany ? selectedCompany.name : "Stock Market Analysis"}
          </h2>
          <div style={roomInfoStyle}>
            <div style={infoItemStyle}>
              <strong>Room:</strong> {roomId}
            </div>
            <div style={infoItemStyle}>
              <strong>Trader:</strong> {user?.name}
            </div>
          </div>
          <div style={controlsStyle}>
            <select
              value={selectedCompany ? selectedCompany.symbol : ""}
              onChange={(e) => {
                const selected = companies.find(
                  (company) => company.symbol === e.target.value
                );
                setSelectedCompany(selected);
              }}
              style={selectStyle}
            >
              <option value="">📊 Select a Company to Analyze</option>
              {companies.map((company) => (
                <option key={company.symbol} value={company.symbol}>
                  {company.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => navigator.clipboard.writeText(roomId)}
              style={buttonStyle}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(16, 185, 129, 0.3)";
                e.target.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(16, 185, 129, 0.2)";
                e.target.style.transform = "translateY(0)";
              }}
            >
              📋 Copy Room ID
            </button>
          </div>
        </header>

        <div style={chartContainerStyle}>
          <svg ref={svgRef} width={800} height={400} style={{ width: "100%", height: "auto" }}></svg>
        </div>

        <div
          ref={tooltipRef}
          style={{
            position: "absolute",
            display: "none",
            background: "rgba(174, 19, 19, 0.98)",
            padding: "15px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
            pointerEvents: "none",
            border: "1px solid rgba(0, 0, 0, 0.1)",
            backdropFilter: "blur(10px)",
            zIndex: 1000,
            minWidth: "200px"
          }}
        ></div>

        <div style={sidebarStyle}>
          <div style={clientsCardStyle}>
            <h3 style={cardTitleStyle}>
              👥 Active Traders ({clientNames.length})
            </h3>
            {clientNames.length > 0 ? (
              <ul style={clientListStyle}>
                {clientNames.map((name, index) => (
                  <li key={index} style={clientItemStyle}>
                    {name || "Anonymous Trader"}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: "14px", margin: 0 }}>
                No traders connected yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomPage;