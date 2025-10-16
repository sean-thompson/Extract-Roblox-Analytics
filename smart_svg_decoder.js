// Smart SVG Chart Data Decoder
// =============================
// Extracts data directly from Highcharts SVG by reverse-engineering coordinates
// Fast, no hovering required, works for any date range

(function() {
    console.log('🚀 Starting smart SVG decoder...\n');

    // Find the chart container
    const chartCard = document.querySelector('.MuiPaper-root.MuiCard-root.web-blox-css-tss-3j2ok9-Card-root');

    if (!chartCard) {
        console.error('❌ Chart container not found!');
        return null;
    }

    console.log('✅ Found chart container');

    // Find the SVG within the container
    const svg = chartCard.querySelector('svg.highcharts-root');

    if (!svg) {
        console.error('❌ SVG chart not found!');
        return null;
    }

    console.log('✅ Found SVG chart');

    const results = {
        dates: [],
        series: [],
        metadata: {
            timestamp: new Date().toISOString(),
            pageUrl: window.location.href
        }
    };

    // Step 1: Extract date labels (X-axis)
    const allTexts = Array.from(svg.querySelectorAll('text, tspan')).map(t => ({
        text: t.textContent.trim(),
        x: t.getBoundingClientRect().x,
        y: t.getBoundingClientRect().y
    }));

    // Dates match pattern: "Oct 9", "Oct 10", etc. or "10/9", "10/10", etc.
    const dateElements = allTexts.filter(t =>
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+$/.test(t.text) ||
        /^\d{1,2}\/\d{1,2}$/.test(t.text)
    ).sort((a, b) => a.x - b.x);

    results.dates = dateElements.map(d => d.text);
    console.log(`✅ Found ${results.dates.length} dates: ${results.dates.join(', ')}`);

    // Step 2: Extract Y-axis scale
    const yAxisTexts = allTexts.filter(t => /^\d+k?$/.test(t.text));

    const yAxisScale = yAxisTexts.map(t => ({
        label: t.text,
        value: t.text.endsWith('k') ? parseInt(t.text) * 1000 : parseInt(t.text),
        y: t.y
    })).sort((a, b) => a.value - b.value);

    if (yAxisScale.length < 2) {
        console.error('❌ Not enough Y-axis labels to determine scale');
        return null;
    }

    const minValue = yAxisScale[0].value;
    const maxValue = yAxisScale[yAxisScale.length - 1].value;
    const minY = yAxisScale[yAxisScale.length - 1].y; // SVG: higher Y = lower value
    const maxY = yAxisScale[0].y;

    console.log(`✅ Y-axis scale: ${minValue} to ${maxValue}`);
    console.log(`   Pixel range: ${minY}px to ${maxY}px`);

    // Function to convert Y pixel to data value
    function yPixelToValue(yPixel) {
        // In SVG, Y increases downward, but values increase upward
        // So we need to invert: when yPixel is at minY (top), value should be maxValue
        const ratio = (yPixel - minY) / (maxY - minY);
        return Math.round(maxValue - (ratio * (maxValue - minValue)));
    }

    // Step 3: Extract legend (series names and colors)
    // Legend markers are in SVG, but names are in DOM divs outside SVG
    // Both follow same position order in a 3x3 grid layout

    console.log(`\n📋 Extracting legend...`);

    // Get legend marker items with colors
    const legendMarkers = Array.from(svg.querySelectorAll('.highcharts-legend-item'))
        .map(item => {
            const graphPath = item.querySelector('.highcharts-graph');
            const marker = item.querySelector('.highcharts-point');
            const color = graphPath ? graphPath.getAttribute('stroke') :
                         marker ? marker.getAttribute('fill') : null;
            const bbox = item.getBoundingClientRect();
            return { color, x: bbox.x, y: bbox.y, element: item };
        })
        .filter(m => m.color);

    // Sort markers by position (top-to-bottom, left-to-right)
    legendMarkers.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 20) return a.y - b.y; // Different rows
        return a.x - b.x; // Same row, sort by x
    });

    console.log(`   Found ${legendMarkers.length} legend markers`);

    // Find label divs with product names
    // They have style="max-width: 200px; text-overflow: ellipsis; overflow: hidden;"
    const labelDivs = Array.from(chartCard.querySelectorAll('div'))
        .filter(div => {
            const style = div.getAttribute('style') || '';
            return style.includes('max-width') &&
                   style.includes('text-overflow') &&
                   style.includes('ellipsis') &&
                   div.textContent.trim().length > 0;
        })
        .map(div => {
            const bbox = div.getBoundingClientRect();
            return {
                name: div.textContent.trim(),
                x: bbox.x,
                y: bbox.y,
                element: div
            };
        });

    // Sort labels by position (same order as markers)
    labelDivs.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
        return a.x - b.x;
    });

    console.log(`   Found ${labelDivs.length} label divs`);

    // Match markers to labels by position
    const legend = legendMarkers.map((marker, idx) => {
        const label = labelDivs[idx];
        const name = label ? label.name : `Series ${idx + 1}`;
        console.log(`   ${name} → ${marker.color}`);
        return {
            name,
            color: marker.color,
            index: idx
        };
    });

    console.log(`✅ Matched ${legend.length} series`);

    // Step 4: Extract data from paths
    // Find all series paths (not grid lines)
    const seriesPaths = Array.from(svg.querySelectorAll('.highcharts-series .highcharts-graph'));

    console.log(`\n📊 Processing ${seriesPaths.length} data series...`);

    seriesPaths.forEach((path, idx) => {
        const pathD = path.getAttribute('d');
        const stroke = path.getAttribute('stroke');

        if (!pathD) return;

        // Find matching legend entry
        const legendEntry = legend.find(l => l.color === stroke);
        const seriesName = legendEntry ? legendEntry.name : `Series ${idx + 1}`;

        console.log(`\nSeries: ${seriesName} (${stroke})`);

        // Parse SVG path to extract points
        // Path uses: M (move), C (curve), L (line)
        const points = [];

        // Extract M and C commands
        const moveMatch = pathD.match(/M\s+([\d.]+)\s+([\d.]+)/);
        if (moveMatch) {
            points.push({ x: parseFloat(moveMatch[1]), y: parseFloat(moveMatch[2]) });
        }

        // Extract all curve endpoints (C x1 y1 x2 y2 x3 y3)
        const curveRegex = /C\s+([\d.\s]+?)(?=\s+[CML]|$)/g;
        let match;
        while ((match = curveRegex.exec(pathD)) !== null) {
            const coords = match[1].trim().split(/\s+/).map(parseFloat);
            // Last two coordinates are the endpoint
            if (coords.length >= 2) {
                points.push({
                    x: coords[coords.length - 2],
                    y: coords[coords.length - 1]
                });
            }
        }

        console.log(`  Extracted ${points.length} data points`);

        // Get SVG bounding box for X-axis mapping
        const svgBBox = svg.getBoundingClientRect();
        const plotArea = svg.querySelector('.highcharts-plot-background');
        const plotBBox = plotArea ? plotArea.getBoundingClientRect() : svgBBox;

        // Convert points to data
        const dataPoints = points.map((point, i) => {
            const value = yPixelToValue(point.y + svgBBox.y);

            // Map X coordinate to date index
            const relativeX = point.x;
            const plotWidth = plotBBox.width;
            const dateIndex = Math.round((relativeX / plotWidth) * (results.dates.length - 1));
            const date = results.dates[Math.min(dateIndex, results.dates.length - 1)];

            return { date, value };
        });

        // Group by date and average (in case multiple points map to same date)
        const grouped = {};
        dataPoints.forEach(p => {
            if (!grouped[p.date]) grouped[p.date] = [];
            grouped[p.date].push(p.value);
        });

        const averaged = Object.keys(grouped).map(date => ({
            date,
            value: Math.round(grouped[date].reduce((a, b) => a + b, 0) / grouped[date].length)
        }));

        // Sort by date order
        averaged.sort((a, b) => {
            const aIdx = results.dates.indexOf(a.date);
            const bIdx = results.dates.indexOf(b.date);
            return aIdx - bIdx;
        });

        console.log('  Data:');
        averaged.forEach(p => {
            console.log(`    ${p.date}: ${p.value.toLocaleString()}`);
        });

        results.series.push({
            name: seriesName,
            color: stroke,
            data: averaged
        });
    });

    // Step 5: Format output
    console.log('\n' + '='.repeat(60));
    console.log('EXTRACTION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Dates: ${results.dates.length}`);
    console.log(`Series: ${results.series.length}`);

    // Create CSV
    let csv = 'Date,' + results.series.map(s => s.name).join(',') + '\n';

    results.dates.forEach(date => {
        const row = [date];
        results.series.forEach(series => {
            const point = series.data.find(d => d.date === date);
            row.push(point ? point.value : '');
        });
        csv += row.join(',') + '\n';
    });

    // Download JSON
    const jsonBlob = new Blob([JSON.stringify(results, null, 2)], {type: 'application/json'});
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = 'roblox_svg_decoded.json';
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);
    URL.revokeObjectURL(jsonUrl);

    // Download CSV
    const csvBlob = new Blob([csv], {type: 'text/csv'});
    const csvUrl = URL.createObjectURL(csvBlob);
    const csvLink = document.createElement('a');
    csvLink.href = csvUrl;
    csvLink.download = 'roblox_data.csv';
    document.body.appendChild(csvLink);
    csvLink.click();
    document.body.removeChild(csvLink);
    URL.revokeObjectURL(csvUrl);

    console.log('\n✅ Downloaded roblox_svg_decoded.json');
    console.log('✅ Downloaded roblox_data.csv');

    return results;
})();
