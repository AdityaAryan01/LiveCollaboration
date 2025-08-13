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

    const width = 1000;
    const height = 500;
    const margin = { top: 40, right: 50, bottom: 70, left: 80 };

    // Enhanced scales
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

    // Create gradient definitions
    const defs = svg.append("defs");
    
    // Gradient for the line
    const lineGradient = defs.append("linearGradient")
      .attr("id", "lineGradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0).attr("y1", height)
      .attr("x2", 0).attr("y2", 0);
    
    lineGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#10B981")
      .attr("stop-opacity", 1);
    
    lineGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#34D399")
      .attr("stop-opacity", 1);

    // Gradient for the area under the curve
    const areaGradient = defs.append("linearGradient")
      .attr("id", "areaGradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0).attr("y1", height)
      .attr("x2", 0).attr("y2", 0);
    
    areaGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#10B981")
      .attr("stop-opacity", 0.1);
    
    areaGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#10B981")
      .attr("stop-opacity", 0.4);

    // Grid lines
    const xGrid = svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale)
        .tickSize(-height + margin.top + margin.bottom)
        .tickFormat("")
      );
    
    xGrid.selectAll("line")
      .style("stroke", "#E5E7EB")
      .style("stroke-opacity", 0.3)
      .style("stroke-width", 0.5);

    const yGrid = svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale)
        .tickSize(-width + margin.left + margin.right)
        .tickFormat("")
      );
    
    yGrid.selectAll("line")
      .style("stroke", "#E5E7EB")
      .style("stroke-opacity", 0.3)
      .style("stroke-width", 0.5);

    // Enhanced axes with better styling
    const xAxis = svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat("%b %d")));

    xAxis.selectAll("text")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("fill", "#E2E8F0");

    xAxis.selectAll("line")
      .style("stroke", "#64748B")
      .style("stroke-width", 1);

    xAxis.select(".domain")
      .style("stroke", "#64748B")
      .style("stroke-width", 2);

    const yAxis = svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => `${d.toFixed(2)}`));

    yAxis.selectAll("text")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("fill", "#E2E8F0");

    yAxis.selectAll("line")
      .style("stroke", "#64748B")
      .style("stroke-width", 1);

    yAxis.select(".domain")
      .style("stroke", "#64748B")
      .style("stroke-width", 2);

    // Add axis labels
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 15)
      .attr("x", -(height / 2))
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("fill", "#E2E8F0")
      .text("Stock Price ($)");

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("fill", "#E2E8F0")
      .text("Date");

    // Area under the curve
    const area = d3.area()
      .x((d) => xScale(parseDate(d.date)))
      .y0(height - margin.bottom)
      .y1((d) => yScale(d.close))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(data)
      .attr("fill", "url(#areaGradient)")
      .attr("d", area);

    // Enhanced line with gradient and shadow
    const line = d3
      .line()
      .x((d) => xScale(parseDate(d.date)))
      .y((d) => yScale(d.close))
      .curve(d3.curveMonotoneX);

    // Shadow line
    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "rgba(0,0,0,0.1)")
      .attr("stroke-width", 3)
      .attr("d", line)
      .attr("transform", "translate(2,2)");

    // Main line with gradient
    const mainLine = svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "url(#lineGradient)")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("d", line);

    // Animate the line drawing
    const totalLength = mainLine.node().getTotalLength();
    mainLine
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);

    // Add data points
    const dots = svg.selectAll(".dot")
      .data(data.filter((d, i) => i % Math.ceil(data.length / 20) === 0)) // Show every nth point
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => xScale(parseDate(d.date)))
      .attr("cy", (d) => yScale(d.close))
      .attr("r", 0)
      .attr("fill", "#10B981")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("opacity", 0.8);

    // Animate dots appearance
    dots.transition()
      .delay((d, i) => i * 100)
      .duration(500)
      .attr("r", 4);

    // Enhanced hover area
    const hoverArea = svg
      .append("rect")
      .attr("width", width - margin.left - margin.right)
      .attr("height", height - margin.top - margin.bottom)
      .attr("transform", `translate(${margin.left},${margin.top})`)
      .style("fill", "none")
      .style("pointer-events", "all");

    // Enhanced hover dot with glow effect
    const hoverDot = svg
      .append("circle")
      .attr("r", 6)
      .attr("fill", "#EF4444")
      .attr("stroke", "white")
      .attr("stroke-width", 3)
      .style("opacity", 0)
      .style("filter", "drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))");

    // Crosshair lines
    const crosshairX = svg
      .append("line")
      .style("stroke", "#9CA3AF")
      .style("stroke-width", 1)
      .style("stroke-dasharray", "3,3")
      .style("opacity", 0);

    const crosshairY = svg
      .append("line")
      .style("stroke", "#9CA3AF")
      .style("stroke-width", 1)
      .style("stroke-dasharray", "3,3")
      .style("opacity", 0);

    hoverArea
      .on("mousemove", (event) => {
        const [x] = d3.pointer(event);
        const bisectDate = d3.bisector((d) => parseDate(d.date)).left;
        const xValue = xScale.invert(x);
        const index = bisectDate(data, xValue, 0, data.length - 1);
        const closestDataPoint = data[index];

        const xPos = xScale(parseDate(closestDataPoint.date));
        const yPos = yScale(closestDataPoint.close);

        // Update hover elements
        hoverDot
          .attr("cx", xPos)
          .attr("cy", yPos)
          .style("opacity", 1);

        crosshairX
          .attr("x1", xPos)
          .attr("x2", xPos)
          .attr("y1", margin.top)
          .attr("y2", height - margin.bottom)
          .style("opacity", 0.7);

        crosshairY
          .attr("x1", margin.left)
          .attr("x2", width - margin.right)
          .attr("y1", yPos)
          .attr("y2", yPos)
          .style("opacity", 0.7);

        // Get the SVG container's position relative to the viewport
        const svgRect = svgRef.current.getBoundingClientRect();
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Calculate tooltip position relative to the cursor position within the SVG
        const cursorX = event.clientX + scrollLeft;
        const cursorY = event.clientY + scrollTop;
        
        // Offset the tooltip slightly from the cursor
        const offsetX = 15;
        const offsetY = -15;
        
        // Enhanced tooltip
        const tooltip = d3.select(tooltipRef.current);
        
        // Check if tooltip would go off-screen and adjust position
        const tooltipWidth = 320; // Approximate width
        const tooltipHeight = 200; // Approximate height
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let finalX = cursorX + offsetX;
        let finalY = cursorY + offsetY;
        
        // Adjust if tooltip would go off the right edge
        if (finalX + tooltipWidth > windowWidth + scrollLeft) {
          finalX = cursorX - tooltipWidth - offsetX;
        }
        
        // Adjust if tooltip would go off the top edge
        if (finalY < scrollTop) {
          finalY = cursorY + offsetY + 30;
        }
        
        // Adjust if tooltip would go off the bottom edge
        if (finalY + tooltipHeight > windowHeight + scrollTop) {
          finalY = cursorY - tooltipHeight + offsetY;
        }
        
        tooltip
          .style("display", "block")
          .style("left", `${finalX}px`)
          .style("top", `${finalY}px`)
          .html(`
            <div style="font-weight: 700; margin-bottom: 12px; color: #1F2937; font-size: 15px; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px;">
              📅 ${closestDataPoint.date}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
              <div style="background: rgba(59, 130, 246, 0.1); padding: 8px; border-radius: 8px; border-left: 3px solid #3B82F6;">
                <div style="color: #6B7280; font-size: 12px; font-weight: 500;">OPEN</div>
                <div style="color: #1F2937; font-weight: 700; font-size: 16px;">${closestDataPoint.open}</div>
              </div>
              <div style="background: rgba(16, 185, 129, 0.1); padding: 8px; border-radius: 8px; border-left: 3px solid #10B981;">
                <div style="color: #6B7280; font-size: 12px; font-weight: 500;">HIGH</div>
                <div style="color: #10B981; font-weight: 700; font-size: 16px;">${closestDataPoint.high}</div>
              </div>
              <div style="background: rgba(239, 68, 68, 0.1); padding: 8px; border-radius: 8px; border-left: 3px solid #EF4444;">
                <div style="color: #6B7280; font-size: 12px; font-weight: 500;">LOW</div>
                <div style="color: #EF4444; font-weight: 700; font-size: 16px;">${closestDataPoint.low}</div>
              </div>
              <div style="background: rgba(99, 102, 241, 0.1); padding: 8px; border-radius: 8px; border-left: 3px solid #6366F1;">
                <div style="color: #6B7280; font-size: 12px; font-weight: 500;">CLOSE</div>
                <div style="color: #6366F1; font-weight: 700; font-size: 16px;">${closestDataPoint.close}</div>
              </div>
            </div>
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; text-align: center;">
              Volume: ${closestDataPoint.volume || 'N/A'}
            </div>
          `);
      })
      .on("mouseout", () => {
        hoverDot.style("opacity", 0);
        crosshairX.style("opacity", 0);
        crosshairY.style("opacity", 0);
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

  // Enhanced animated stock-themed background
  const backgroundPattern = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: `
      radial-gradient(circle at 15% 30%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
      radial-gradient(circle at 85% 70%, rgba(34, 197, 94, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 50% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 20% 80%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
      linear-gradient(135deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px),
      linear-gradient(45deg, rgba(34, 197, 94, 0.02) 1px, transparent 1px)
    `,
    backgroundSize: "100% 100%, 100% 100%, 100% 100%, 100% 100%, 60px 60px, 40px 40px",
    animation: "stockFloat 25s ease-in-out infinite, pulseGlow 8s ease-in-out infinite alternate",
    zIndex: 1,
    overflow: "hidden"
  };

  // Floating stock symbols and charts
  const floatingElements = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 2,
    overflow: "hidden"
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
    background: "rgba(255, 255, 255, 0.08)",
    borderRadius: "24px",
    backdropFilter: "blur(15px)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)"
  };

  const titleStyle = {
    fontSize: "2.5rem",
    fontWeight: "800",
    color: "white",
    marginBottom: "10px",
    textShadow: "0 4px 8px rgba(0,0,0,0.3)",
    background: "linear-gradient(135deg, #ffffff, #10B981)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text"
  };

  const roomInfoStyle = {
    display: "flex",
    justifyContent: "center",
    gap: "30px",
    flexWrap: "wrap",
    marginBottom: "20px"
  };

  const infoItemStyle = {
    background: "rgba(16, 185, 129, 0.15)",
    padding: "12px 24px",
    borderRadius: "30px",
    border: "1px solid rgba(16, 185, 129, 0.4)",
    color: "#10B981",
    fontSize: "14px",
    fontWeight: "600",
    boxShadow: "0 4px 15px rgba(16, 185, 129, 0.2)"
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
    padding: "14px 24px",
    borderRadius: "16px",
    border: "2px solid rgba(255, 255, 255, 0.2)",
    background: "rgba(255, 255, 255, 0.1)",
    color: "white",
    fontSize: "16px",
    fontWeight: "500",
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    outline: "none",
    minWidth: "250px",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)"
  };

  const buttonStyle = {
    padding: "14px 28px",
    background: "rgba(16, 185, 129, 0.2)",
    border: "2px solid #10B981",
    borderRadius: "16px",
    color: "#10B981",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    backdropFilter: "blur(10px)",
    boxShadow: "0 4px 15px rgba(16, 185, 129, 0.2)"
  };

  const chartContainerStyle = {
    background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 50%, rgba(51, 65, 85, 0.85) 100%)",
    borderRadius: "24px",
    padding: "30px",
    marginBottom: "30px",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    position: "relative",
    overflow: "hidden",
    backdropFilter: "blur(20px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  };

  const sidebarStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    marginTop: "20px"
  };

  const clientsCardStyle = {
    background: "rgba(255, 255, 255, 0.12)",
    borderRadius: "20px",
    padding: "25px",
    backdropFilter: "blur(15px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)"
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
    background: "rgba(16, 185, 129, 0.15)",
    padding: "10px 18px",
    borderRadius: "12px",
    marginBottom: "8px",
    color: "#10B981",
    fontSize: "14px",
    fontWeight: "500",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    transition: "all 0.3s ease",
    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.1)"
  };

  return (
    <div style={containerStyle}>
      <style>
        {`
          @keyframes stockFloat {
            0%, 100% { 
              transform: translateY(0px) rotate(0deg) scale(1);
              filter: hue-rotate(0deg);
            }
            25% { 
              transform: translateY(-15px) rotate(2deg) scale(1.02);
              filter: hue-rotate(10deg);
            }
            50% { 
              transform: translateY(-10px) rotate(-1deg) scale(0.98);
              filter: hue-rotate(20deg);
            }
            75% { 
              transform: translateY(-20px) rotate(1deg) scale(1.01);
              filter: hue-rotate(10deg);
            }
          }

          @keyframes pulseGlow {
            0% { 
              opacity: 0.3;
              box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
            }
            100% { 
              opacity: 0.6;
              box-shadow: 0 0 40px rgba(16, 185, 129, 0.2);
            }
          }

          @keyframes floatSymbol {
            0% {
              transform: translateY(100vh) rotate(0deg);
              opacity: 0;
            }
            10% {
              opacity: 0.7;
            }
            90% {
              opacity: 0.7;
            }
            100% {
              transform: translateY(-100px) rotate(360deg);
              opacity: 0;
            }
          }

          @keyframes chartFloat {
            0% {
              transform: translateX(-100px) translateY(0px);
              opacity: 0;
            }
            20% {
              opacity: 0.4;
            }
            80% {
              opacity: 0.4;
            }
            100% {
              transform: translateX(calc(100vw + 100px)) translateY(-20px);
              opacity: 0;
            }
          }

          .floating-symbol {
            position: absolute;
            font-size: 24px;
            font-weight: 700;
            color: rgba(16, 185, 129, 0.3);
            animation: floatSymbol 15s linear infinite;
            text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
          }

          .floating-symbol:nth-child(2n) {
            color: rgba(34, 197, 94, 0.25);
            animation-duration: 18s;
            font-size: 20px;
          }

          .floating-symbol:nth-child(3n) {
            color: rgba(59, 130, 246, 0.2);
            animation-duration: 20s;
            font-size: 18px;
          }

          .floating-chart {
            position: absolute;
            width: 80px;
            height: 40px;
            opacity: 0.3;
            animation: chartFloat 25s linear infinite;
          }

          .floating-chart:nth-child(even) {
            animation-duration: 30s;
            animation-delay: -10s;
          }

          .grid line {
            shape-rendering: crispEdges;
          }
          
          select option {
            background: #1F2937;
            color: white;
          }
          
          select:hover {
            border-color: rgba(16, 185, 129, 0.5);
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.2);
          }

          /* Glowing particles effect */
          @keyframes particle {
            0% {
              transform: translateY(0) scale(0);
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
            100% {
              transform: translateY(-200px) scale(1);
              opacity: 0;
            }
          }

          .particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.8) 0%, transparent 70%);
            border-radius: 50%;
            animation: particle 8s linear infinite;
          }
        `}
      </style>
      <div style={backgroundPattern}></div>
      
      {/* Floating Stock Elements */}
      <div style={floatingElements}>
        {/* Floating Stock Symbols */}
        <div className="floating-symbol" style={{ left: '10%', animationDelay: '0s' }}>📈</div>
        <div className="floating-symbol" style={{ left: '20%', animationDelay: '3s' }}>💹</div>
        <div className="floating-symbol" style={{ left: '30%', animationDelay: '6s' }}>📊</div>
        <div className="floating-symbol" style={{ left: '40%', animationDelay: '2s' }}>💰</div>
        <div className="floating-symbol" style={{ left: '50%', animationDelay: '8s' }}>💲</div>
        <div className="floating-symbol" style={{ left: '60%', animationDelay: '4s' }}>📈</div>
        <div className="floating-symbol" style={{ left: '70%', animationDelay: '7s' }}>💹</div>
        <div className="floating-symbol" style={{ left: '80%', animationDelay: '1s' }}>📊</div>
        <div className="floating-symbol" style={{ left: '90%', animationDelay: '5s' }}>💰</div>

        {/* Mini Floating Charts */}
        <div className="floating-chart" style={{ left: '5%', top: '20%', animationDelay: '0s' }}>
          <svg width="80" height="40" viewBox="0 0 80 40">
            <path d="M5,35 Q20,10 35,15 T65,5" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="2" fill="none" />
          </svg>
        </div>
        
        <div className="floating-chart" style={{ left: '15%', top: '60%', animationDelay: '8s' }}>
          <svg width="80" height="40" viewBox="0 0 80 40">
            <path d="M5,30 L15,25 L25,35 L35,10 L45,15 L55,8 L65,20 L75,5" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="2" fill="none" />
          </svg>
        </div>

        <div className="floating-chart" style={{ left: '75%', top: '40%', animationDelay: '15s' }}>
          <svg width="80" height="40" viewBox="0 0 80 40">
            <path d="M5,20 Q25,5 45,12 Q65,25 75,8" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* Animated Particles */}
        <div className="particle" style={{ left: '15%', animationDelay: '0s' }}></div>
        <div className="particle" style={{ left: '25%', animationDelay: '2s' }}></div>
        <div className="particle" style={{ left: '45%', animationDelay: '4s' }}></div>
        <div className="particle" style={{ left: '65%', animationDelay: '1s' }}></div>
        <div className="particle" style={{ left: '85%', animationDelay: '3s' }}></div>

        {/* Floating Stock Tickers */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '0%',
          fontSize: '14px',
          fontWeight: '600',
          color: 'rgba(16, 185, 129, 0.2)',
          animation: 'chartFloat 35s linear infinite',
          fontFamily: 'monospace'
        }}>
          AAPL +2.4% • GOOGL +1.8% • TSLA +3.2% • MSFT +1.1% • AMZN +2.7%
        </div>

        <div style={{
          position: 'absolute',
          top: '80%',
          right: '0%',
          fontSize: '12px',
          fontWeight: '500',
          color: 'rgba(34, 197, 94, 0.25)',
          animation: 'chartFloat 40s linear infinite reverse',
          fontFamily: 'monospace',
          animationDelay: '-20s'
        }}>
          DOW +150.2 • S&P +23.4 • NASDAQ +89.7 • VIX -2.1
        </div>
      </div>
      
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
                e.target.style.boxShadow = "0 8px 25px rgba(16, 185, 129, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(16, 185, 129, 0.2)";
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(16, 185, 129, 0.2)";
              }}
            >
              📋 Copy Room ID
            </button>
          </div>
        </header>

        <div style={chartContainerStyle}>
          <svg ref={svgRef} width={1000} height={500} style={{ width: "100%", height: "auto", maxWidth: "1000px" }}></svg>
        </div>

        <div
          ref={tooltipRef}
          style={{
            position: "absolute",
            display: "none",
            background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)",
            padding: "20px",
            borderRadius: "16px",
            boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            pointerEvents: "none",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            backdropFilter: "blur(20px)",
            zIndex: 1000,
            minWidth: "280px",
            maxWidth: "320px"
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
                  <li 
                    key={index} 
                    style={clientItemStyle}
                    onMouseEnter={(e) => {
                      e.target.style.background = "rgba(16, 185, 129, 0.25)";
                      e.target.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "rgba(16, 185, 129, 0.15)";
                      e.target.style.transform = "translateY(0)";
                    }}
                  >
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