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

### Step 2: Extract Accurate Date Range
Extracts the precise date range from the page's date selector (`.MuiSelect-select`), which shows the exact start and end dates in format "10/14/2023 - 10/16/2025". The script:
- Parses the full date range with year information
- Calculates total days between start and end dates
- Uses **proportional mapping** to assign each SVG data point to the correct date
- Falls back to `data-testid="date-description"` or SVG axis labels if selector not found

**Key Innovation: Proportional Point-to-Date Mapping**
Instead of assuming 1 point = 1 day (which fails for large date ranges), the algorithm maps each point based on its position:
```
Point i → Date at position (i / (numPoints - 1)) × totalDays
```
This works perfectly for any data granularity:
- **13 points for 90 days**: Each point represents ~7 days (weekly data)
- **90 points for 90 days**: Each point represents 1 day (daily data)
- **730 points for 730 days**: Each point represents 1 day (2-year daily data)

### Step 3: Build Y-Axis Scale
- Finds Y-axis labels (0, 25k, 50k, 75k, 100k, etc.)
- Maps pixel positions to actual values
- Creates a linear scale for converting SVG coordinates to real numbers

### Step 4: Detect Date Format
Determines whether to use slash format ("10/9") or month name format ("Oct 9") by examining the SVG axis labels.

### Step 5: Match Legend to Data Series
This is the tricky part:
- **Legend markers** (colored shapes) are inside the SVG as `<g class="highcharts-legend-item">` elements
- **Product names** are in separate `<div>` elements outside the SVG (with `max-width: 200px; text-overflow: ellipsis` styles)
- Both are arranged in the same 3×3 grid layout
- Script sorts both by screen position (top-to-bottom, left-to-right)
- Matches them 1:1 based on position order

### Step 6: Decode SVG Paths and Map to Dates
- Each data series is a `<path>` element with SVG coordinates
- Paths use Bézier curves (M and C commands) to draw the lines
- Script extracts all coordinate points from each path
- Converts Y coordinates back to data values using the scale
- Maps each point to a date using **proportional positioning** (not pixel-based guessing)
- Works accurately regardless of data granularity (daily, weekly, or mixed)

### Step 7: Export Data
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

## Recent Improvements (v2.1)

### Fixed: Multi-Year Date Collision (v2.1)
**Problem**: Dates from different years were colliding (e.g., "Oct 14" from 2023, 2024, 2025 all mapped to same CSV row), causing data to be summed incorrectly and Y-axis values to appear 3x too high.

**Solution**: Implemented year-aware date formatting:
- Detects when date range spans multiple years
- Automatically includes year in date strings: "10/14/2023" instead of "10/14"
- Year-aware date sorting prevents collisions
- Tested with 2-year range (366 points) → 100% unique dates

**Impact**: Multi-year ranges (e.g., "10/14/2023 - 10/16/2025") now produce accurate CSVs with correct date labels and values.

### Fixed: Long-Range Date Alignment (v2.0)
**Problem**: The original script assumed 1 SVG point = 1 day, which failed for large date ranges where Highcharts uses weekly or sparse data points.

**Solution**: Implemented proportional point-to-date mapping that works for any data granularity:
- Extracts exact date range from page selector
- Maps each point based on its position: `Point i → Day round((i / (N-1)) × totalDays)`
- Tested and verified with 90-day weekly data (13 points → 13 perfect dates)

**Impact**: Now handles 7-day, 90-day, 365-day, and multi-year ranges accurately.

## Advantages Over Tooltip Method

| Method | Speed | Date Range | Reliability |
|--------|-------|------------|-------------|
| **SVG Decoding v2.1** | < 1 second | Any (including multi-year) | ✅ Always works |
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

**Dates are misaligned**
- Verify the date-description element is present on the page
- Check console for warnings about date extraction
- Ensure the page is fully loaded before running the script

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

## Date Range Accuracy and Proportional Mapping

The script uses intelligent proportional mapping to handle any data granularity:

### How It Works
1. **Extract date range from selector** - Finds the `.MuiSelect-select` element containing "10/14/2023 - 10/16/2025"
2. **Parse with full year information** - No more year guessing or inference errors
3. **Calculate total days** - End date is exclusive: if range shows "10/14/2023 - 10/16/2025", data runs from 10/14/2023 to 10/15/2025 (last point is day before end date)
4. **Proportional point mapping** - Each SVG point i maps to: `date = startDate + round((i / (numPoints - 1)) × totalDays) days`
5. **Fallback chain** - If selector not found, tries `data-testid="date-description"`, then SVG axis labels

### Example 1: 90-Day Range with Weekly Data
- **Date selector**: "7/21/2023 - 10/14/2023"
- **Actual data range**: July 21 to October 13 (84 days, 13 weeks)
- **SVG points extracted**: 13 points (one per week)
- **Multi-year detection**: NO (same year)
- **Date format**: "Jul 21", "Jul 28", ... (no year needed)
- **Proportional mapping**:
  - Point 0 → 0/12 × 84 days = Day 0 = Jul 21 ✅
  - Point 6 → 6/12 × 84 days = Day 42 = Sep 1 ✅
  - Point 12 → 12/12 × 84 days = Day 84 = Oct 13 ✅

### Example 2: 2-Year Range with Daily-ish Data
- **Date selector**: "10/14/2023 - 10/16/2025"
- **Actual data range**: October 14, 2023 to October 15, 2025 (733 days)
- **SVG points extracted**: 366 points (~2 days per point)
- **Multi-year detection**: YES (spans 2023-2025)
- **Date format**: "10/14/2023", "10/16/2023", ... (year included!)
- **Proportional mapping**:
  - Point 0 → 0/365 × 732 days = Day 0 = 10/14/2023 ✅
  - Point 183 → 183/365 × 732 days = Day 367 = 10/15/2024 ✅
  - Point 365 → 365/365 × 732 days = Day 732 = 10/15/2025 ✅
- **Result**: 366 unique dates (no collisions), correct Y-axis values

### Why This Works Better Than Old Approaches
- **v1.0 (1:1 assumption)**: Generated 84 daily dates, tried to map 13 points → misalignment
- **v2.0 (proportional, no year)**: Maps 13 points correctly, but multi-year dates collide
- **v2.1 (proportional + year-aware)**: Perfect alignment for any range, prevents multi-year collisions

## Future Improvements

- Auto-detect if legend layout changes
- Support multiple charts on one page
- Handle different date formats
- Add data validation against known patterns
