const URL_GEOJSON = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";
const URL_RAW_DATA = "honeypot.csv"; 

const tooltip = d3.select("#tooltip");

d3.timeFormatDefaultLocale({
    dateTime: "%A, le %e %B %Y, %X",
    date: "%d/%m/%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days:["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
    shortDays:["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
    months:["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    shortMonths:["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
});

let countryDataMap, timeData, heatmapData = [], topCountriesHeatmap = [], topPortsHeatmap =[];
let gMap, projection, path, svgMap, mapZoom;

// --- NAVIGATION ---
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    if(pageId === 'time-page') drawTimeExplorer();
    if(pageId === 'tech-page') drawHeatmap();
    if(pageId === 'sankey-page') drawSankey();
}

// --- CHARGEMENT ---
Promise.all([ d3.json(URL_GEOJSON), d3.csv(URL_RAW_DATA) ]).then(results => { processData(results[0], results[1]); });

function processData(geo, rawData) {
    window.geoData = geo;
    const parseTime = d3.timeParse("%m/%d/%y %H:%M");
    const formatDay = d3.timeFormat("%Y-%m-%d");

    rawData.forEach(d => {
        const fullDate = parseTime(d.datetime);
        d.dayString = fullDate ? formatDay(fullDate) : null;
        d.proto = d.proto || "Inconnu";
        d.longitude = d.longitude ? parseFloat(d.longitude) : null;
        d.latitude = d.latitude ? parseFloat(d.latitude) : null;
    });

    const validData = rawData.filter(d => d.dayString && d.country);
    window.validData = validData; 

    // 1. CARTE
    countryDataMap = d3.rollup(validData, v => ({
        total: v.length, protos: d3.rollup(v, vv => vv.length, d => d.proto),
        hosts: d3.rollup(v, vv => vv.length, d => d.host), ports: d3.rollup(v, vv => vv.length, d => d.dpt)
    }), d => getCSVCountryName(d.country)); // Correction avec le bon nom dès l'agrégation

    // 2. TEMPOREL
    const timeRollup = d3.rollup(validData, v => {
        const protos = d3.rollup(v, vv => vv.length, d => d.proto);
        return { date: d3.timeParse("%Y-%m-%d")(v[0].dayString), total: v.length, TCP: protos.get("TCP")||0, UDP: protos.get("UDP")||0, ICMP: protos.get("ICMP")||0 };
    }, d => d.dayString);
    timeData = Array.from(timeRollup.values()).sort((a,b) => a.date - b.date);

    // 3. MATRICE 
    const countryTotals = d3.rollup(validData, v => v.length, d => getCSVCountryName(d.country));
    const portTotals = d3.rollup(validData, v => v.length, d => d.dpt);
    topCountriesHeatmap = Array.from(countryTotals).sort((a,b) => b[1] - a[1]).slice(0, 10).map(d => d[0]);
    topPortsHeatmap = Array.from(portTotals).filter(d => d[0] !== "").sort((a,b) => b[1] - a[1]).slice(0, 15).map(d => d[0]);

    const matrixRollup = d3.rollup(validData, v => v.length, d => getCSVCountryName(d.country), d => d.dpt);
    topCountriesHeatmap.forEach(country => {
        topPortsHeatmap.forEach(port => {
            const portsForCountry = matrixRollup.get(country);
            heatmapData.push({ country, port, value: portsForCountry ? (portsForCountry.get(port) || 0) : 0 });
        });
    });

    d3.select("#loader").style("opacity", 0);
    setTimeout(() => {
        d3.select("#loader").style("display", "none");
        document.getElementById("home-page").classList.add("active");
        drawWorldMap();
    }, 500);
}

// ==========================================
// 1. CARTE
// ==========================================
const mapWidth = 1000, mapHeight = 600;

function getCSVCountryName(geoName) {
    const map = {
        "USA": "United States", "United States of America": "United States",
        "England": "United Kingdom", "Republic of Korea": "South Korea",
        "Democratic People's Republic of Korea": "North Korea", "Taiwan": "Taiwan",
        "Iran (Islamic Republic of)": "Iran", "Russian Federation": "Russia",
        "Myanmar": "Myanmar [Burma]", "Côte d'Ivoire": "Ivory Coast",
        "Czech Republic": "Czechia", "Republic of Serbia": "Serbia",
        "United Republic of Tanzania": "Tanzania", "The Bahamas": "Bahamas",
        "Syrian Arab Republic": "Syria", "Venezuela (Bolivarian Republic of)": "Venezuela",
        "Bolivia (Plurinational State of)": "Bolivia", "Viet Nam": "Vietnam",
        "Republic of Moldova": "Moldova", "Lao People's Democratic Republic": "Laos",
        "Brunei Darussalam": "Brunei", "Macau": "Macao", "Palestinian Territory": "Palestine",
        "West Bank": "Palestine", "Gaza": "Palestine", "Cabo Verde": "Cape Verde",
        "Micronesia (Federated States of)": "Micronesia", "Macedonia": "Macedonia",
        "North Macedonia": "Macedonia", "Republic of Congo": "Congo",
        "Democratic Republic of the Congo": "Congo", "Swaziland": "Eswatini"
    };
    return map[geoName] || geoName;
}

function drawWorldMap() {
    const container = d3.select("#map-container").html("");
    const popup = container.append("div").attr("id", "map-popup").attr("class", "map-info-popup");
    
    svgMap = container.append("svg").attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`).style("width", "100%").style("height", "100%");
    projection = d3.geoMercator().scale(150).translate([mapWidth / 2, mapHeight / 1.5]);
    path = d3.geoPath().projection(projection);

    const colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, Math.log(d3.max(Array.from(countryDataMap.values()), d => d.total) + 1)]);

    svgMap.append("rect").attr("width", mapWidth).attr("height", mapHeight).style("fill", "transparent").on("click", resetZoom);
    gMap = svgMap.append("g");

    gMap.selectAll("path").data(window.geoData.features).enter().append("path")
        .attr("class", "country").attr("d", path)
        .attr("fill", d => {
            const csvName = getCSVCountryName(d.properties.name);
            const cData = countryDataMap.get(csvName);
            return cData ? colorScale(Math.log(cData.total + 1)) : "#e2e8f0";
        })
        .attr("stroke", "#ffffff").attr("stroke-width", 0.5)
        .on("click", zoomToCountry).on("mouseover", showTooltipMap).on("mouseout", hideTooltip);
        
    mapZoom = d3.zoom().scaleExtent([1, 8]).on("zoom", e => gMap.attr("transform", e.transform));
}

function zoomToCountry(event, d) {
    event.stopPropagation(); hideTooltip();
    const csvName = getCSVCountryName(d.properties.name);
    const cData = countryDataMap.get(csvName);
    const popup = d3.select("#map-popup").classed("visible", false);
    const [[x0, y0],[x1, y1]] = path.bounds(d);
    const zoomScale = Math.min(8, 0.9 / Math.max((x1-x0)/mapWidth, (y1-y0)/mapHeight));

    svgMap.transition().duration(750).call(mapZoom.transform, d3.zoomIdentity.translate(mapWidth/2, mapHeight/2).scale(zoomScale).translate(-(x0+x1)/2, -(y0+y1)/2))
    .on("end", () => {
        drawLocales(csvName, zoomScale);
        if(!cData) popup.html(`<h3>${d.properties.name}</h3><p>Aucune attaque enregistrée.</p>`);
        else {
            const getTop3 = (mapObj) => Array.from(mapObj).filter(a => a[0] !== "").sort((a,b) => b[1] - a[1]).slice(0, 3);
            popup.html(`
                <h3 style="color:var(--primary); font-size:1.4rem;">${d.properties.name}</h3>
                <p>Total Attaques : <strong>${cData.total.toLocaleString()}</strong></p>
                <div class="popup-stats">
                    <div class="popup-col"><h4>Protocoles</h4><ul>${getTop3(cData.protos).map(p=>`<li>${p[0]}: ${Math.round((p[1]/cData.total)*100)}%</li>`).join('')}</ul></div>
                    <div class="popup-col"><h4>Top Ports</h4><ul>${getTop3(cData.ports).map(p=>`<li>Port ${p[0]}</li>`).join('')}</ul></div>
                    <div class="popup-col"><h4>Top Cibles</h4><ul>${getTop3(cData.hosts).map(h=>`<li>${h[0]}</li>`).join('')}</ul></div>
                </div>
            `);
        }
        popup.classed("visible", true);
    });
}

function resetZoom() { 
    d3.select("#map-popup").classed("visible", false); 
    gMap.selectAll(".locale-point").remove(); 
    svgMap.transition().duration(750).call(mapZoom.transform, d3.zoomIdentity); 
}

function drawLocales(countryName, transformK) {
    gMap.selectAll(".locale-point").remove();
    const localData = window.validData.filter(d => getCSVCountryName(d.country) === countryName && d.longitude !== null && d.latitude !== null);
    if(localData.length === 0) return;

    const localeGroups = d3.rollup(localData, v => ({ count: v.length, locale: v[0].locale || "Région Inconnue" }), d => d.longitude + "," + d.latitude);
    const localePoints = Array.from(localeGroups, ([coords, data]) => {
        const [lon, lat] = coords.split(',').map(Number);
        return { lon, lat, count: data.count, locale: data.locale };
    });

    const rScale = d3.scaleSqrt().domain([0, d3.max(localePoints, d => d.count)]).range([2, 10]);

    gMap.selectAll(".locale-point").data(localePoints).enter().append("circle").attr("class", "locale-point")
        .attr("cx", d => projection([d.lon, d.lat])[0]).attr("cy", d => projection([d.lon, d.lat])[1])
        .attr("r", 0).attr("fill", "#fbbf24").attr("fill-opacity", 0.8)
        .attr("stroke", "#1e293b").attr("stroke-width", 0.5 / transformK)
        .on("mouseover", function(event, d) {
            tooltip.style("opacity", 1).html(`<b>Région/Ville :</b> ${d.locale}<br><b>Attaques :</b> ${d.count.toLocaleString()}`)
                   .style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
            d3.select(this).attr("stroke-width", 2 / transformK).attr("fill", "#f59e0b");
        }).on("mouseout", function() {
            tooltip.style("opacity", 0); d3.select(this).attr("stroke-width", 0.5 / transformK).attr("fill", "#fbbf24");
        }).transition().duration(500).attr("r", d => rScale(d.count) / Math.sqrt(transformK));
}

function showTooltipMap(event, d) {
    const csvName = getCSVCountryName(d.properties.name);
    const count = countryDataMap.get(csvName) ? countryDataMap.get(csvName).total : 0;
    tooltip.style("opacity", 1).html(`<strong>${d.properties.name}</strong><br/>Attaques : ${count.toLocaleString()}`)
           .style("left", event.pageX+"px").style("top", (event.pageY-20)+"px");
}

// ==========================================
// 2. TIMELINE 
// ==========================================
function drawTimeExplorer() {
    const margin = {top: 50, right: 20, bottom: 110, left: 60}, 
          margin2 = {top: 330, right: 20, bottom: 30, left: 60}, 
          width = 1100 - margin.left - margin.right, 
          height = 400 - margin.top - margin.bottom, 
          height2 = 400 - margin2.top - margin2.bottom;
          
    const container = d3.select("#line-focus-container").html("");
    const svg = container.append("svg").attr("viewBox", `0 0 1100 400`).style("width", "100%");

    const keys =["TCP", "UDP", "ICMP"];
    const colorsObj = {"TCP": "#3b82f6", "UDP": "#f59e0b", "ICMP": "#ef4444"};
    const color = d3.scaleOrdinal().domain(keys).range([colorsObj.TCP, colorsObj.UDP, colorsObj.ICMP]); 
    const stackedData = d3.stack().keys(keys)(timeData);

    svg.append("defs").append("clipPath").attr("id", "clip").append("rect").attr("width", width).attr("height", height);

    const x = d3.scaleTime().domain(d3.extent(timeData, d=>d.date)).range([0, width]);
    const x2 = d3.scaleTime().domain(x.domain()).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(timeData, d=>d.total)]).range([height, 0]);
    const y2 = d3.scaleLinear().domain(y.domain()).range([height2, 0]);

    // RÈGLE SUR-MESURE POUR L'AXE DES DATES
    function customTickFormat(date) {
        return (d3.timeMonth(date) < date ? d3.timeFormat("%d %b") : d3.timeFormat("%B"))(date);
    }

    const xAxis = d3.axisBottom(x).tickFormat(customTickFormat);
    const xAxis2 = d3.axisBottom(x2).tickFormat(customTickFormat);
    const yAxis = d3.axisLeft(y).tickFormat(d3.format("~s"));

    const area = d3.area().x(d=>x(d.data.date)).y0(d=>y(d[0])).y1(d=>y(d[1])).curve(d3.curveMonotoneX);
    const area2 = d3.area().x(d=>x2(d.data.date)).y0(d=>y2(d[0])).y1(d=>y2(d[1])).curve(d3.curveMonotoneX);

    // LÉGENDE 
    const legendGroup = svg.append("g").attr("transform", `translate(${margin.left + 20}, 15)`);
    keys.forEach((key, i) => {
        const g = legendGroup.append("g").attr("transform", `translate(${i * 100}, 0)`);
        g.append("rect").attr("width", 15).attr("height", 15).attr("fill", colorsObj[key]).attr("rx", 3);
        g.append("text").attr("x", 25).attr("y", 12).text(key).style("font-size", "14px").style("font-weight", "600").style("fill", "var(--text-dark)");
    });

    const focus = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const context = svg.append("g").attr("transform", `translate(${margin2.left},${margin2.top})`);

    focus.append("g").attr("clip-path", "url(#clip)").selectAll(".layer").data(stackedData).enter().append("path").attr("class", "layer").attr("fill", d=>color(d.key)).attr("d", area);
    
    // AXE X 
    const focusXAxis = focus.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`).call(xAxis); 
    focus.append("g").call(yAxis);

    const hoverLine = focus.append("line").attr("y1", 0).attr("y2", height).style("stroke", "#1e293b").style("stroke-dasharray", "4").style("opacity", 0);
    focus.append("rect").attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
    .on("mousemove", function(e) {
        const x0 = x.invert(d3.pointer(e, this)[0]), i = d3.bisector(d=>d.date).left(timeData, x0, 1);
        if(!timeData[i-1] || !timeData[i]) return;
        const d = x0 - timeData[i-1].date > timeData[i].date - x0 ? timeData[i] : timeData[i-1];
        hoverLine.attr("x1", x(d.date)).attr("x2", x(d.date)).style("opacity", 1);
        // Note : Le format de la date utilise %B pour afficher "avril" au lieu de "April"
        tooltip.style("opacity", 1).html(`<b>${d3.timeFormat("%d %B %Y")(d.date)}</b><hr/>Total: <b>${d.total.toLocaleString()}</b><br/><span style="color:#60a5fa">TCP: ${d.TCP.toLocaleString()}</span><br/><span style="color:#fbbf24">UDP: ${d.UDP.toLocaleString()}</span><br/><span style="color:#f87171">ICMP: ${d.ICMP.toLocaleString()}</span>`)
               .style("left", (e.pageX+20)+"px").style("top", (e.pageY-50)+"px");
    }).on("mouseout", () => { hoverLine.style("opacity", 0); hideTooltip(); });

    context.selectAll(".layer2").data(stackedData).enter().append("path").attr("fill", d=>color(d.key)).attr("d", area2);
    context.append("g").attr("transform", `translate(0,${height2})`).call(xAxis2);
    
    // Ajout du module de sélection ("Brush") SANS lui imposer de position initiale
    context.append("g").attr("class", "brush").call(d3.brushX().extent([[0, 0],[width, height2]]).on("brush end", e => {
        x.domain((e.selection || x2.range()).map(x2.invert, x2));
        focus.selectAll(".layer").attr("d", area); 
        focusXAxis.call(xAxis);
    }));
}

// ==========================================
// 3. MATRICE / HEATMAP 
// ==========================================
function drawHeatmap() {
    const margin = {top: 100, right: 30, bottom: 30, left: 150},
          width = 1100 - margin.left - margin.right, height = 700 - margin.top - margin.bottom;

    const container = d3.select("#heatmap-container").html("");
    const svg = container.append("svg").attr("viewBox", `0 0 1100 700`).style("width", "100%");
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().range([0, width]).domain(topCountriesHeatmap).padding(0.05);
    const y = d3.scaleBand().range([0, height]).domain(topPortsHeatmap).padding(0.05);
    const colorScale = d3.scaleSequential(d => d3.interpolateReds(Math.log(d + 1) / Math.log(d3.max(heatmapData, d=>d.value) + 1)));

    g.append("g").call(d3.axisTop(x).tickSize(0)).select(".domain").remove();
    g.selectAll(".tick text").attr("transform", "translate(-10,-15) rotate(-45)").style("text-anchor", "start").style("font-size", "15px").style("font-weight", "600");

    const yAxisGroup = g.append("g").call(d3.axisLeft(y).tickSize(0));
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll("text").text(d => `Port ${d}`).style("font-size", "15px").style("font-weight", "600");

    g.selectAll(".cell").data(heatmapData).enter().append("rect").attr("class", "cell")
        .attr("x", d=>x(d.country)).attr("y", d=>y(d.port)).attr("rx", 6).attr("ry", 6)
        .attr("width", x.bandwidth()).attr("height", y.bandwidth())
        .style("fill", d => d.value === 0 ? "#f8fafc" : colorScale(d.value))
        .on("mouseover", function(e, d) {
            tooltip.style("opacity", 1).html(`Origine: <b>${d.country}</b><br>Cible: <b>Port ${d.port}</b><br>Volume: <b style="color:#fca5a5">${d.value.toLocaleString()}</b>`)
                   .style("left", (e.pageX+15)+"px").style("top", (e.pageY-40)+"px");
        }).on("mouseout", hideTooltip);
}

// ==========================================
// 4. SANKEY DIAGRAM
// ==========================================
function drawSankey() {
    const margin = {top: 30, right: 30, bottom: 30, left: 30},
          width = 1100 - margin.left - margin.right,
          height = 900 - margin.top - margin.bottom;

    const container = d3.select("#sankey-container").html("");
    const svg = container.append("svg")
                         .attr("viewBox", `0 0 1100 900`)
                         .style("width", "100%")
                         .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Agréger les données : TOP 20 Pays et TOP 20 Ports
    const countryCounts = d3.rollup(window.validData, v => v.length, d => getCSVCountryName(d.country));
    const topCountries = Array.from(countryCounts).sort((a,b) => b[1] - a[1]).slice(0, 20).map(d => d[0]); // 👈 Passage à 20 ici

    const portCounts = d3.rollup(window.validData, v => v.length, d => d.dpt);
    const topPorts = Array.from(portCounts).filter(d => d[0] !== "").sort((a,b) => b[1] - a[1]).slice(0, 20).map(d => d[0]);

    // Filtrage
    const sankeyData = window.validData.filter(d => topCountries.includes(getCSVCountryName(d.country)) && topPorts.includes(d.dpt));

    let nodesMap = new Map();
    let linksMap = new Map();

    function addNode(name, category) {
        if (!nodesMap.has(name)) { nodesMap.set(name, { id: nodesMap.size, name: name, category: category }); }
        return nodesMap.get(name).id;
    }

    // Création des liens
    sankeyData.forEach(d => {
        const cName = getCSVCountryName(d.country);
        const proto = "Protocole : " + (d.proto || "Inconnu");
        const port = "Port : " + d.dpt;

        const cId = addNode(cName, "Country");
        const protoId = addNode(proto, "Protocol");
        const portId = addNode(port, "Port");

        const link1 = cId + "-" + protoId;
        linksMap.set(link1, (linksMap.get(link1) || 0) + 1);

        const link2 = protoId + "-" + portId;
        linksMap.set(link2, (linksMap.get(link2) || 0) + 1);
    });

    const nodes = Array.from(nodesMap.values());
    const links = Array.from(linksMap, ([key, value]) => {
        const parts = key.split("-");
        return { source: parseInt(parts[0]), target: parseInt(parts[1]), value: value };
    });

    // 2. Générateur Sankey 
    const sankey = d3.sankey().nodeWidth(25).nodePadding(10).size([width, height]);
    const {nodes: sNodes, links: sLinks} = sankey({
        nodes: nodes.map(d => Object.assign({}, d)), links: links.map(d => Object.assign({}, d))
    });

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    // 3. Dessin des Liens
    svg.append("g").selectAll(".link").data(sLinks).enter().append("path").attr("class", "sankey-link")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => d.source.category === "Country" ? "#93c5fd" : "#fca5a5") 
        .attr("stroke-width", d => Math.max(1, d.width)).attr("fill", "none").attr("opacity", 0.4)
        .on("mouseover", function(e, d) {
            tooltip.style("opacity", 1).html(`<strong>${d.source.name} → ${d.target.name}</strong><br/>Flux : <span style="color:#fcd34d">${d.value.toLocaleString()} attaques</span>`)
                   .style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 30) + "px");
        }).on("mouseout", hideTooltip);

    // 4. Dessin des Noeuds
    const node = svg.append("g").selectAll(".node").data(sNodes).enter().append("g").attr("class", "node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    node.append("rect").attr("height", d => Math.max(1, d.y1 - d.y0)).attr("width", sankey.nodeWidth()) // Math.max(1, ...) évite les hauteurs nulles
        .attr("fill", d => colorScale(d.category)).attr("stroke", "#1e293b")
        .on("mouseover", function(e, d) {
            tooltip.style("opacity", 1).html(`<strong>${d.name}</strong><br/>Total trafic : ${d.value.toLocaleString()}`)
                   .style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 30) + "px");
        }).on("mouseout", hideTooltip);
    
    node.append("text").attr("x", -8).attr("y", d => (d.y1 - d.y0) / 2).attr("dy", "0.35em")
        .attr("text-anchor", "end").text(d => d.name).style("font-size", "11px").style("font-weight", "600").style("fill", "#1e293b")
        .filter(d => d.x0 < width / 2).attr("x", 8 + sankey.nodeWidth()).attr("text-anchor", "start");
}

function hideTooltip() { tooltip.style("opacity", 0); }
document.addEventListener("mousemove", (event) => {
    if(tooltip.style("opacity") == 1 && (document.getElementById('map-page').classList.contains('active') || document.getElementById('sankey-page').classList.contains('active'))) {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px");
    }
});
