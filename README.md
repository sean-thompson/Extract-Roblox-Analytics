# Roblox Analytics Data Extractor

## What This Does

Extracts sales data from the Roblox Creator Dashboard analytics charts **instantly** (< 1 second) without requiring API access or slow tooltip simulation.

## Quick Start

1. Go to your Roblox Creator Dashboard Analytics page
2. Select the date range you want to analyze
3. Open browser console (F12)
4. Paste the entire contents of `smart_svg_decoder.js`
5. Press Enter
6. Two files download automatically:
   - `roblox_svg_decoded.json` - Structured data with all series
   - `roblox_data.csv` - Spreadsheet-ready format

## How It Works

The script reverse-engineers the Highcharts SVG visualization to extract the underlying data:

### Step 1: Locate the Chart
Finds the chart container using the specific MUI classes that wrap the analytics chart.

### Step 2: Extract Date Labels
Reads the X-axis text elements to get the date range (e.g., "Oct 9", "Oct 10", "Oct 11"...).

### Step 3: Build Y-Axis Scale
- Finds Y-axis labels (0, 25k, 50k, 75k, 100k, etc.)
- Maps pixel positions to actual values
- Creates a linear scale for converting SVG coordinates to real numbers

### Step 4: Match Legend to Data Series
This is the tricky part:
- **Legend markers** (colored shapes) are inside the SVG as `<g class="highcharts-legend-item">` elements
- **Product names** are in separate `<div>` elements outside the SVG (with `max-width: 200px; text-overflow: ellipsis` styles)
- Both are arranged in the same 3×3 grid layout
- Script sorts both by screen position (top-to-bottom, left-to-right)
- Matches them 1:1 based on position order

### Step 5: Decode SVG Paths
- Each data series is a `<path>` element with SVG coordinates
- Paths use Bézier curves (M and C commands) to draw the lines
- Script extracts all coordinate points from each path
- Converts Y coordinates back to data values using the scale
- Maps X coordinates to dates based on position

### Step 6: Export Data
Formats the extracted data as both JSON and CSV for easy analysis.

## Why We Can't Extract Data Directly

### What We Tried

1. **Global Highcharts object** - Not accessible; library is bundled inside React components
2. **`window.Highcharts.charts`** - Doesn't exist; Highcharts is namespaced/hidden
3. **`__NEXT_DATA__` script tag** - Contains no chart data, only page metadata
4. **React component props** - Data is in private React Fiber internal state, not accessible from outside
5. **Network API calls** - Require bearer tokens (authentication), can't be called directly
6. **Direct DOM data attributes** - Chart data isn't stored in data-* attributes

### Why This Approach Works

The Highcharts library **must render the data visually** to display the chart. Once rendered:
- ✅ SVG coordinates contain all the data (just needs decoding)
- ✅ Axis labels provide the scale for conversion
- ✅ Legend elements provide series names and colors
- ✅ Everything is in the DOM and publicly accessible

We're essentially doing what your eyes do when you read the chart - but programmatically.

## Advantages Over Tooltip Method

| Method | Speed | Date Range | Reliability |
|--------|-------|------------|-------------|
| **SVG Decoding** | < 1 second | Any | ✅ Always works |
| **Tooltip Simulation** | 5-10 minutes | Limited by hover count | ⚠️ Can miss data |

The tooltip method works but becomes impractical for large date ranges because it must:
1. Find every chart point (potentially hundreds)
2. Simulate hover events on each one
3. Wait for tooltip to appear
4. Capture and parse tooltip text
5. Repeat hundreds of times

## Technical Notes

### Y-Axis Inversion
SVG coordinates have Y increasing downward, but chart values increase upward. The script inverts this:
```javascript
// When Y pixel is at top (minY), value should be maxValue
const ratio = (yPixel - minY) / (maxY - minY);
return maxValue - (ratio * (maxValue - minValue));
```

### Path Parsing
SVG paths use commands like:
- `M x y` - Move to point
- `C x1 y1 x2 y2 x3 y3` - Cubic Bézier curve (last pair is endpoint)

The script extracts all endpoints to get the actual data coordinates.

### Legend Matching
Since legend text is outside the SVG, we can't use direct parent-child relationships. Instead:
1. Both markers and labels are in reading order (left-to-right, top-to-bottom)
2. Sort both arrays by screen position (Y coordinate first, then X)
3. Index 0 in markers matches index 0 in labels, etc.

## Limitations

- **Requires visible chart** - Page must be fully loaded with chart rendered
- **Screen position dependent** - Legend matching relies on visual layout
- **Highcharts specific** - Only works with Highcharts SVG structure
- **Approximation** - Values are rounded based on pixel precision

## Sample Output

```json
{
  "dates": ["Oct 9", "Oct 10", "Oct 11", "Oct 12", "Oct 13", "Oct 14", "Oct 15"],
  "series": [
    {
      "name": "Total",
      "color": "#3C64FA",
      "data": [
        { "date": "Oct 9", "value": 76209 },
        { "date": "Oct 10", "value": 82652 },
        { "date": "Oct 11", "value": 99632 },
        { "date": "Oct 12", "value": 103517 }
      ]
    },
    {
      "name": "Furry Yellow Chick Suit",
      "color": "#44DA87",
      "data": [...]
    }
  ]
}
```

## Troubleshooting

**"Chart container not found"**
- Make sure you're on the Analytics page with a chart visible
- Check if Roblox changed their CSS classes

**"Not enough Y-axis labels"**
- Chart might still be loading - wait a moment and try again
- Some date ranges might have different scales

**Series names are wrong**
- Legend layout changed - may need to adjust the position sorting logic
- Check if div styles changed (look for `max-width: 200px`)

**Values seem off**
- Verify the Y-axis scale is being read correctly
- Check console output for the detected min/max values
- Compare one known value to validate

## Files

- `smart_svg_decoder.js` - Main extraction script (run in browser console)
- `roblox_svg_decoded.json` - Output: Full structured data
- `roblox_data.csv` - Output: Spreadsheet format
- `README_SVG_EXTRACTION.md` - This file

## Testing

To validate the extraction:
1. Run the script on a known date range
2. Compare extracted values to tooltips on the chart
3. Check that Oct 12 Total ≈ 103,517 (or your expected value)
4. Verify all series are labeled correctly
5. Confirm date range matches what you selected

## Future Improvements

- Auto-detect if legend layout changes
- Support multiple charts on one page
- Handle different date formats
- Add data validation against known patterns
