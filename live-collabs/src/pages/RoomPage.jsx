import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";

const socket = io("http://localhost:5001", {
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
  const [data, setData] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [clientIds, setClientIds] = useState([]); // New state for connected client IDs
  const svgRef = useRef();
  const tooltipRef = useRef();
  const parseDate = d3.timeParse("%Y-%m-%d");

  useEffect(() => {
    if (roomId) {
      socket.emit("joinStockRoom", roomId);
    }
  }, [roomId]);

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

    // Listen for updates on the room's client IDs
    socket.on("roomClients", (clients) => {
      console.log("Updated room clients:", clients);
      setClientIds(clients);
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
      (d) =>
        !isNaN(parseDate(d.date)) &&
        typeof d.close === "number"
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
      .attr("stroke", "lightgreen")
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
      .attr("r", 3)
      .attr("fill", "red")
      .attr("stroke", "black")
      .attr("stroke-width", 1)
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
            <strong>Date:</strong> ${closestDataPoint.date}<br>
            <strong>Open:</strong> ${closestDataPoint.open}<br>
            <strong>High:</strong> ${closestDataPoint.high}<br>
            <strong>Low:</strong> ${closestDataPoint.low}<br>
            <strong>Close:</strong> ${closestDataPoint.close}
          `);
      })
      .on("mouseout", () => {
        hoverDot.style("opacity", 0);
        d3.select(tooltipRef.current).style("display", "none");
      });
  }, [data]);

  return (
    <div style={{ textAlign: "center" }}>
      <h2>{selectedCompany ? selectedCompany.name : "Select a Company"} Stock Prices</h2>
      <p>
        <strong>Room ID:</strong> {roomId}
      </p>
      <button onClick={() => navigator.clipboard.writeText(roomId)}>
        Copy Room ID
      </button>
      <div>
        <label htmlFor="company-select">Select Company: </label>
        <select
          id="company-select"
          value={selectedCompany ? selectedCompany.symbol : ""}
          onChange={(e) => {
            const selected = companies.find(
              (company) => company.symbol === e.target.value
            );
            setSelectedCompany(selected);
          }}
        >
          <option value="">--Select Company--</option>
          {companies.map((company) => (
            <option key={company.symbol} value={company.symbol}>
              {company.name}
            </option>
          ))}
        </select>
      </div>
      <svg ref={svgRef} width={800} height={400}></svg>
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          display: "none",
          backgroundColor: "white",
          padding: "10px",
          borderRadius: "5px",
          boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.3)",
          pointerEvents: "none",
        }}
      ></div>
      <div style={{ marginTop: "20px" }}>
        <h3>Clients in Room:</h3>
        {clientIds.length > 0 ? (
          <ul>
            {clientIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        ) : (
          <p>No clients connected.</p>
        )}
      </div>
    </div>
  );
};

export default RoomPage;
