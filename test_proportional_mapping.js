// Test script to verify proportional date mapping logic
// This simulates the core algorithm without needing the full HTML page

function testProportionalMapping() {
    console.log('=== Testing Proportional Date Mapping ===\n');

    // Simulate Ripple 90 Days scenario
    const startDate = new Date(2023, 6, 21);  // July 21, 2023
    const endDate = new Date(2023, 9, 13);    // October 13, 2023 (day before Oct 14)
    const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

    console.log(`Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`Total Days: ${totalDays + 1} days (0 to ${totalDays})\n`);

    // Simulate 13 SVG points (like the Ripple example)
    const numPoints = 13;
    console.log(`Number of SVG Points: ${numPoints}\n`);

    // Expected dates from the JSON (what we saw in the Ripple example)
    const expectedDates = [
        "Jul 21", "Jul 28", "Aug 4", "Aug 11", "Aug 18", "Aug 25",
        "Sep 1", "Sep 8", "Sep 15", "Sep 22", "Sep 29", "Oct 6", "Oct 13"
    ];

    console.log('Expected Dates (from original extraction):');
    expectedDates.forEach((d, i) => console.log(`  Point ${i}: ${d}`));
    console.log();

    // Apply proportional mapping
    console.log('Calculated Dates (using new proportional algorithm):');
    const calculatedDates = [];

    for (let i = 0; i < numPoints; i++) {
        // Point i maps to day at position i/(numPoints-1) along the range
        const dayOffset = Math.round((i / (numPoints - 1)) * totalDays);

        // Calculate the actual date
        const date = new Date(startDate.getTime() + dayOffset * 86400000);

        // Format as "Jul 21"
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${monthNames[date.getMonth()]} ${date.getDate()}`;

        calculatedDates.push(formattedDate);
        console.log(`  Point ${i}: ${formattedDate} (day ${dayOffset})`);
    }

    // Compare results
    console.log('\n=== Comparison ===');
    let matches = 0;
    let closeEnough = 0;

    for (let i = 0; i < numPoints; i++) {
        const expected = expectedDates[i];
        const calculated = calculatedDates[i];
        const match = expected === calculated;

        if (match) {
            matches++;
            console.log(`✅ Point ${i}: ${calculated} (exact match)`);
        } else {
            // Check if they're within a few days
            const parseDateSimple = (str) => {
                const monthMap = {
                    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                };
                const match = str.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)$/);
                if (match) {
                    return new Date(2023, monthMap[match[1]], parseInt(match[2]));
                }
                return null;
            };

            const expectedDate = parseDateSimple(expected);
            const calculatedDate = parseDateSimple(calculated);
            const daysDiff = Math.abs((expectedDate - calculatedDate) / 86400000);

            if (daysDiff <= 7) {
                closeEnough++;
                console.log(`⚠️  Point ${i}: ${calculated} vs ${expected} (${daysDiff.toFixed(0)} days off - acceptable)`);
            } else {
                console.log(`❌ Point ${i}: ${calculated} vs ${expected} (${daysDiff.toFixed(0)} days off)`);
            }
        }
    }

    console.log(`\n=== Results ===`);
    console.log(`Exact matches: ${matches}/${numPoints}`);
    console.log(`Close enough (≤7 days): ${closeEnough}/${numPoints}`);
    console.log(`Total acceptable: ${matches + closeEnough}/${numPoints}`);

    if (matches === numPoints) {
        console.log('✅ Perfect! Algorithm produces exact matches.');
    } else if (matches + closeEnough === numPoints) {
        console.log('✅ Good! All dates are within acceptable range (weekly data).');
    } else {
        console.log('⚠️ Some dates are significantly off. Algorithm may need adjustment.');
    }
}

// Run the test
testProportionalMapping();
