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
  const lists = [
    ev.jurisdictions,
    ev.affected_countries,
    ev.affected_countries_hint,
  ];
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

        const drawArc = (source, target, color) => {
          if (!source || !target) return;
          const arc = d3.line().curve(d3.curveBasis)([
            source,
            [(source[0] + target[0]) / 2, Math.min(source[1], target[1]) - 150],
            target,
          ]);
          const line = svg
            .append("path")
            .attr("d", arc)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "6,4")
            .attr("opacity", 0.85)
            .style("filter", "url(#glow)");
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
            drawn.add(cname);
            const feature = countries.find((c) => (c.properties?.name || "").toLowerCase() === cname);
            if (!feature) return;
            const coords = path.centroid(feature);
            const color = modeB
              ? eventRiskNames.has(cname)
                ? red
                : blue
              : anyEventRisk.has(cname)
                ? red
                : blue;
            drawArc(coords, usCoords, color);
            drawPulse(coords, color);
          });
        });

        if (drawn.size === 0 && (events || []).length > 0) {
          const cnCoords = projection([104.1, 35.8]);
          const twCoords = projection([120.9, 23.6]);
          if (cnCoords) {
            drawArc(cnCoords, usCoords, red);
            drawPulse(cnCoords, red);
          }
          if (twCoords) {
            drawArc(twCoords, usCoords, blue);
            drawPulse(twCoords, blue);
          }
        }
      });
  }, [events, boms, activeMapEvent]);

  return (
    <>
      <style>{`@keyframes dash { to { stroke-dashoffset: -1000; } }`}</style>
      <svg ref={svgRef} style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
    </>
  );
}
