import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";

const ISO2_TO_NAME = {
  CN: "china",
  US: "united states",
  TW: "taiwan",
  VN: "vietnam",
  BR: "brazil",
  MX: "mexico",
  IN: "india",
  KR: "south korea",
  DE: "germany",
  JP: "japan",
  CA: "canada",
  GB: "united kingdom",
  RU: "russia",
  FR: "france",
  IT: "italy",
  AU: "australia",
  NZ: "new zealand",
  SG: "singapore",
  MY: "malaysia",
  TH: "thailand",
  PH: "philippines",
  ID: "indonesia",
  PL: "poland",
  NL: "netherlands",
  ES: "spain",
  SE: "sweden",
  TR: "turkey",
  IE: "ireland",
  CH: "switzerland",
  AT: "austria",
  BE: "belgium",
  PT: "portugal",
  AR: "argentina",
  CL: "chile",
  CO: "colombia",
  ZA: "south africa",
  EG: "egypt",
  IL: "israel",
  AE: "united arab emirates",
  SA: "saudi arabia",
  ET: "ethiopia",
};

// Tariff corridor metadata — April 2026 trade policy
const CORRIDOR_INFO = {
  china:        { rate: "145%", label: "China → US", note: "Section 301 + reciprocal tariffs. Packaging & components severely impacted." },
  vietnam:      { rate: "46%",  label: "Vietnam → US", note: "Reciprocal tariff active. Robusta beans & paper filters at risk." },
  ethiopia:     { rate: "10%",  label: "Ethiopia → US", note: "Baseline tariff only — African nations spared reciprocal rates (Apr 2026)." },
  colombia:     { rate: "10%",  label: "Colombia → US", note: "Baseline tariff. Arabica beans remain competitive vs. tariffed rivals." },
  mexico:       { rate: "0%",   label: "Mexico → US", note: "USMCA exemption — tariff-free corridor for packaging & boxes." },
  brazil:       { rate: "10%",  label: "Brazil → US", note: "Baseline tariff. World's largest coffee producer, Arabica dominant." },
  taiwan:       { rate: "32%",  label: "Taiwan → US", note: "Reciprocal tariff (90-day pause). Semiconductor & component risk." },
  india:        { rate: "26%",  label: "India → US", note: "Reciprocal tariff. Specialty spice & tea supply chains affected." },
  indonesia:    { rate: "32%",  label: "Indonesia → US", note: "Reciprocal tariff. Robusta coffee & palm oil supply chains at risk." },
  "south korea":{ rate: "25%",  label: "South Korea → US", note: "Reciprocal tariff. Electronics & auto parts impacted." },
};

function normalizeCountryName(raw) {
  if (!raw) return "";
  const t = String(raw).trim();
  if (t.length === 2) {
    const n = ISO2_TO_NAME[t.toUpperCase()];
    return n || t.toLowerCase();
  }
  return t.toLowerCase();
}

function addEventJurisdictionsToSet(ev, set) {
  if (!ev) return;
  const lists = [ev.jurisdictions, ev.affected_countries, ev.affected_countries_hint];
  lists.forEach((arr) => {
    (arr || []).forEach((code) => {
      const n = normalizeCountryName(code);
      if (n) set.add(n);
    });
  });
}

function riskNamesAllEvents(events) {
  const set = new Set();
  (events || []).forEach((ev) => addEventJurisdictionsToSet(ev, set));
  return set;
}

function supplierNamesFromBoms(boms) {
  const set = new Set();
  (boms || []).forEach((b) => {
    (b.rows || []).forEach((r) => {
      const n = normalizeCountryName(r.supplier_country);
      if (n) set.add(n);
    });
  });
  return set;
}

export function D3WorldMap({ events, boms, activeMapEvent }) {
  const svgRef = useRef();
  const tooltipRef = useRef();

  useEffect(() => {
    fetch("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
      .then((r) => r.json())
      .then((world) => {
        const countries = topojson.feature(world, world.objects.countries).features;
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const node = svg.node();
        if (!node) return;
        const width = node.getBoundingClientRect().width;
        const height = node.getBoundingClientRect().height;

        const projection = d3
          .geoNaturalEarth1()
          .scale(width / 5.5)
          .translate([width / 2, height / 2 + 50]);
        const path = d3.geoPath().projection(projection);

        const g = svg.append("g");

        const supplierCountries = supplierNamesFromBoms(boms);
        const modeB = !!activeMapEvent;
        const eventRiskNames = modeB
          ? (() => {
              const s = new Set();
              addEventJurisdictionsToSet(activeMapEvent, s);
              return s;
            })()
          : riskNamesAllEvents(events);

        g.selectAll("path.country")
          .data(countries)
          .enter()
          .append("path")
          .attr("class", "country")
          .attr("d", path)
          .attr("stroke", "rgba(0,0,0,0.06)")
          .attr("stroke-width", 1)
          .attr("fill", (d) => {
            const cname = (d.properties?.name || "").toLowerCase();
            if (modeB) {
              if (eventRiskNames.has(cname)) return "rgba(209,67,67,0.35)";
              if (supplierCountries.has(cname)) return "rgba(76,111,174,0.28)";
              return "rgba(245,245,245,0.85)";
            }
            if (eventRiskNames.has(cname)) return "rgba(209,67,67,0.22)";
            if (supplierCountries.has(cname)) return "rgba(76,111,174,0.18)";
            return "rgba(255,255,255,0.7)";
          });

        const usCoords = projection([-95.7, 37.0]);
        if (!usCoords) return;

        const defs = svg.append("defs");
        const filter = defs.append("filter").attr("id", "glow");
        filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        const tooltip = d3.select(tooltipRef.current);

        const drawArc = (source, target, color, cname) => {
          if (!source || !target) return;
          const arc = d3.line().curve(d3.curveBasis)([
            source,
            [(source[0] + target[0]) / 2, Math.min(source[1], target[1]) - 150],
            target,
          ]);

          const info = CORRIDOR_INFO[cname] || { rate: "varies", label: `${cname} → US`, note: "Trade corridor." };

          // Invisible wider hit area for easier hovering
          svg
            .append("path")
            .attr("d", arc)
            .attr("fill", "none")
            .attr("stroke", "transparent")
            .attr("stroke-width", 14)
            .style("cursor", "pointer")
            .on("mousemove", (event) => {
              const [mx, my] = d3.pointer(event, svgRef.current.parentElement);
              tooltip
                .style("display", "block")
                .style("left", `${mx + 14}px`)
                .style("top", `${my - 10}px`)
                .html(`
                  <div style="font-weight:600;font-size:12px;margin-bottom:4px">${info.label}</div>
                  <div style="font-size:11px;color:${color};font-weight:700;margin-bottom:4px">Tariff Rate: ${info.rate}</div>
                  <div style="font-size:11px;color:#666;line-height:1.4">${info.note}</div>
                `);
            })
            .on("mouseleave", () => tooltip.style("display", "none"));

          const line = svg
            .append("path")
            .attr("d", arc)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "6,4")
            .attr("opacity", 0.85)
            .style("filter", "url(#glow)")
            .style("pointer-events", "none");

          const totalLength = line.node().getTotalLength();
          line
            .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(2000)
            .attr("stroke-dashoffset", 0)
            .on("end", function () {
              d3.select(this).attr("stroke-dasharray", "6,4").style("animation", "dash 20s linear infinite");
            });
        };

        const drawPulse = (coords, color) => {
          if (!coords) return;
          svg
            .append("circle")
            .attr("cx", coords[0])
            .attr("cy", coords[1])
            .attr("r", 4)
            .attr("fill", color)
            .style("pointer-events", "none")
            .append("animate")
            .attr("attributeName", "r")
            .attr("values", "4;12;4")
            .attr("dur", "2s")
            .attr("repeatCount", "indefinite");
          svg
            .append("circle")
            .attr("cx", coords[0])
            .attr("cy", coords[1])
            .attr("r", 4)
            .attr("fill", color)
            .style("pointer-events", "none")
            .append("animate")
            .attr("attributeName", "opacity")
            .attr("values", "1;0;1")
            .attr("dur", "2s")
            .attr("repeatCount", "indefinite");
        };

        const hubColor = modeB ? "rgba(120,120,130,0.5)" : "var(--fg-1)";
        drawPulse(usCoords, hubColor);

        const drawn = new Set();
        const red = "var(--sev-critical)";
        const blue = "var(--domain-reshore)";
        const anyEventRisk = riskNamesAllEvents(events);

        boms.forEach((b) => {
          (b.rows || []).forEach((r) => {
            const cname = normalizeCountryName(r.supplier_country);
            if (!cname || drawn.has(cname)) return;
            // In Mode B, skip BOM suppliers not mentioned in the active event
            if (modeB && !eventRiskNames.has(cname)) return;
            drawn.add(cname);
            const feature = countries.find((c) => (c.properties?.name || "").toLowerCase() === cname);
            if (!feature) return;
            const coords = path.centroid(feature);
            const color = modeB
              ? red
              : anyEventRisk.has(cname) ? red : blue;
            drawArc(coords, usCoords, color, cname);
            drawPulse(coords, color);
          });
        });

        if (drawn.size === 0) {
          if (modeB && activeMapEvent) {
            // Draw arcs for every country mentioned in the active event's jurisdictions
            countries.forEach(feature => {
              const cname = (feature.properties?.name || "").toLowerCase();
              if (!eventRiskNames.has(cname)) return;
              const coords = path.centroid(feature);
              if (!coords || isNaN(coords[0])) return;
              drawArc(coords, usCoords, red, cname);
              drawPulse(coords, red);
            });
          } else if ((events || []).length > 0) {
            // Demo arcs when no BOM uploaded and no active event filter
            const cnCoords = projection([104.1, 35.8]);
            const twCoords = projection([120.9, 23.6]);
            if (cnCoords) { drawArc(cnCoords, usCoords, red, "china"); drawPulse(cnCoords, red); }
            if (twCoords) { drawArc(twCoords, usCoords, blue, "taiwan"); drawPulse(twCoords, blue); }
          }
        }
      });
  }, [events, boms, activeMapEvent]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <style>{`@keyframes dash { to { stroke-dashoffset: -1000; } }`}</style>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      <div
        ref={tooltipRef}
        style={{
          display: "none",
          position: "absolute",
          background: "rgba(255,255,255,0.97)",
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: 8,
          padding: "10px 12px",
          pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          maxWidth: 220,
          zIndex: 10,
        }}
      />
    </div>
  );
}
