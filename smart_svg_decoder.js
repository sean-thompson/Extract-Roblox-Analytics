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

    // Step 1: Extract actual date range from HTML date selector
    let extractedDateRange = null;

    // Try the date selector first (MuiSelect with format "10/14/2023 - 10/16/2025")
    const dateSelector = document.querySelector('.MuiSelect-select[aria-labelledby*="label"]');

    if (dateSelector) {
        const dateText = dateSelector.textContent.trim();
        const dateRangeMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);

        if (dateRangeMatch) {
            const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = dateRangeMatch;
            extractedDateRange = {
                start: new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay)),
                end: new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay))
            };
            console.log(`✅ Extracted date range from selector: ${startMonth}/${startDay}/${startYear} to ${endMonth}/${endDay}/${endYear}`);
        } else {
            console.warn('⚠️ Found date selector but could not parse date range');
        }
    }

    // Fallback: Try the data-testid approach
    if (!extractedDateRange) {
        const dateDescElement = document.querySelector('[data-testid="date-description"]');
        if (dateDescElement) {
            const dateText = dateDescElement.textContent;
            const dateRangeMatch = dateText.match(/Data from (\d{1,2})\/(\d{1,2})\/(\d{4}) to (\d{1,2})\/(\d{1,2})\/(\d{4})/);

            if (dateRangeMatch) {
                const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = dateRangeMatch;
                extractedDateRange = {
                    start: new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay)),
                    end: new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay))
                };
                console.log(`✅ Extracted date range from data-testid: ${startMonth}/${startDay}/${startYear} to ${endMonth}/${endDay}/${endYear}`);
            }
        }
    }

    if (!extractedDateRange) {
        console.warn('⚠️ Could not find date range element, will use SVG labels');
    }

    // Step 2: Extract date labels from SVG (for format detection and fallback)
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

    const visibleDates = dateElements.map(d => d.text);
    console.log(`✅ Found ${visibleDates.length} visible date labels: ${visibleDates.join(', ')}`);

    // Determine date format from SVG labels
    const useSlashFormat = visibleDates.length > 0 && /^\d{1,2}\/\d{1,2}$/.test(visibleDates[0]);

    function formatDate(date, includeYear = false) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        if (includeYear) {
            if (useSlashFormat) {
                return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
            } else {
                return `${monthNames[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
            }
        } else {
            if (useSlashFormat) {
                return `${date.getMonth() + 1}/${date.getDate()}`;
            } else {
                return `${monthNames[date.getMonth()]} ${date.getDate()}`;
            }
        }
    }

    // Step 3: Store date range for proportional mapping (don't generate all dates yet)
    if (extractedDateRange) {
        // Calculate total days in range (end date is exclusive, so subtract 1 day)
        const startDate = extractedDateRange.start;
        const endDate = new Date(extractedDateRange.end.getTime() - 86400000); // Day before end date
        const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

        // Detect if range spans multiple years
        const spanMultipleYears = startDate.getFullYear() !== endDate.getFullYear();

        // Store for later use
        results.dateRange = {
            start: startDate,
            end: endDate,
            totalDays: totalDays,
            spanMultipleYears: spanMultipleYears
        };

        console.log(`✅ Date range: ${formatDate(startDate, spanMultipleYears)} to ${formatDate(endDate, spanMultipleYears)} (${totalDays + 1} days total)`);
    } else if (visibleDates.length > 1) {
        // Fallback: use SVG labels to determine date range
        console.warn('⚠️ Using fallback: extracting date range from SVG labels');

        function parseDate(dateStr) {
            const monthMap = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };

            if (/^\d{1,2}\/\d{1,2}$/.test(dateStr)) {
                const [month, day] = dateStr.split('/').map(Number);
                return new Date(new Date().getFullYear(), month - 1, day);
            } else {
                const match = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)$/);
                if (match) {
                    const month = monthMap[match[1]];
                    const day = parseInt(match[2]);
                    return new Date(new Date().getFullYear(), month, day);
                }
            }
            return null;
        }

        const firstDate = visibleDates[0];
        const lastDate = visibleDates[visibleDates.length - 1];
        const startDate = parseDate(firstDate);
        const endDate = parseDate(lastDate);

        if (startDate && endDate && endDate > startDate) {
            const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

            // Detect if range spans multiple years
            const spanMultipleYears = startDate.getFullYear() !== endDate.getFullYear();

            results.dateRange = {
                start: startDate,
                end: endDate,
                totalDays: totalDays,
                spanMultipleYears: spanMultipleYears
            };

            console.log(`✅ Date range from SVG: ${formatDate(startDate, spanMultipleYears)} to ${formatDate(endDate, spanMultipleYears)} (${totalDays + 1} days total)`);
        } else {
            console.warn('⚠️ Could not parse date range from SVG labels');
        }
    }

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

        // Convert points to data using proportional date mapping
        const svgBBox = svg.getBoundingClientRect();
        let finalData;

        if (results.dateRange) {
            // Use proportional mapping: each point i maps to a date based on its position in the range
            console.log(`  Using proportional mapping (${points.length} points across ${results.dateRange.totalDays + 1} days)`);

            finalData = points.map((point, i) => {
                const value = yPixelToValue(point.y + svgBBox.y);

                // Calculate which day this point represents
                // Point 0 = day 0 (start date), Point N-1 = day totalDays (end date)
                const dayOffset = Math.round((i / (points.length - 1)) * results.dateRange.totalDays);

                // Calculate the actual date
                const date = new Date(results.dateRange.start.getTime() + dayOffset * 86400000);
                const formattedDate = formatDate(date, results.dateRange.spanMultipleYears);

                return { date: formattedDate, value };
            });
        } else {
            // Fallback: use simple sequential numbering (shouldn't happen often)
            console.warn(`  ⚠️ No date range found, using sequential fallback`);

            finalData = points.map((point, i) => {
                const value = yPixelToValue(point.y + svgBBox.y);

                // Generate a simple sequential date
                const date = `Point ${i}`;

                return { date, value };
            });
        }

        console.log('  Data:');
        finalData.forEach(p => {
            console.log(`    ${p.date}: ${p.value.toLocaleString()}`);
        });

        results.series.push({
            name: seriesName,
            color: stroke,
            data: finalData
        });
    });

    // Step 5: Build complete date list from all series data
    const allDates = new Set();
    results.series.forEach(series => {
        series.data.forEach(point => allDates.add(point.date));
    });
    results.dates = Array.from(allDates).sort((a, b) => {
        // Parse dates for sorting
        const parseForSort = (dateStr) => {
            const monthMap = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };

            // Handle "Oct 12 2023" format (with year)
            const monthYearMatch = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)\s+(\d{4})$/);
            if (monthYearMatch) {
                return new Date(parseInt(monthYearMatch[3]), monthMap[monthYearMatch[1]], parseInt(monthYearMatch[2]));
            }

            // Handle "10/12/2023" format (with year)
            const slashYearMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (slashYearMatch) {
                return new Date(parseInt(slashYearMatch[3]), parseInt(slashYearMatch[1]) - 1, parseInt(slashYearMatch[2]));
            }

            // Handle "Oct 12" format (no year - fallback for single-year ranges)
            const monthMatch = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)$/);
            if (monthMatch) {
                return new Date(2000, monthMap[monthMatch[1]], parseInt(monthMatch[2]));
            }

            // Handle "10/12" format (no year - fallback)
            const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
            if (slashMatch) {
                return new Date(2000, parseInt(slashMatch[1]) - 1, parseInt(slashMatch[2]));
            }

            return new Date(dateStr);
        };
        return parseForSort(a) - parseForSort(b);
    });

    // Step 6: Format output
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
