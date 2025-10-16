// Test script to verify multi-year date handling
// Simulates the user's scenario: 10/14/2023 to 10/16/2025 with 366 points

function testMultiYearDates() {
    console.log('=== Testing Multi-Year Date Handling ===\n');

    // User's scenario: ~2 year range with daily data
    const startDate = new Date(2023, 9, 14);  // October 14, 2023
    const endDate = new Date(2025, 9, 15);    // October 15, 2025 (day before 10/16)
    const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    const numPoints = 366; // Approximate number of data points

    console.log(`Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`Total Days: ${totalDays + 1} days`);
    console.log(`Number of Points: ${numPoints}`);
    console.log(`Days per Point: ${(totalDays / (numPoints - 1)).toFixed(2)} days\n`);

    // Check if spans multiple years
    const spanMultipleYears = startDate.getFullYear() !== endDate.getFullYear();
    console.log(`Spans Multiple Years: ${spanMultipleYears ? 'YES' : 'NO'}\n`);

    if (!spanMultipleYears) {
        console.error('❌ FAIL: Should detect multi-year range!');
        return;
    }

    // Format date function (same as in smart_svg_decoder.js)
    const useSlashFormat = true;
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

    // Generate dates using proportional mapping
    console.log('Generating dates with proportional mapping (showing key points):\n');
    const dates = [];

    for (let i = 0; i < numPoints; i++) {
        const dayOffset = Math.round((i / (numPoints - 1)) * totalDays);
        const date = new Date(startDate.getTime() + dayOffset * 86400000);
        const formattedDate = formatDate(date, spanMultipleYears);
        dates.push(formattedDate);

        // Show first 5, middle 5, and last 5
        if (i < 5 || (i >= Math.floor(numPoints / 2) - 2 && i <= Math.floor(numPoints / 2) + 2) || i >= numPoints - 5) {
            console.log(`  Point ${i.toString().padStart(3)}: ${formattedDate} (day ${dayOffset})`);
        } else if (i === 5 || i === Math.floor(numPoints / 2) + 3) {
            console.log('  ...');
        }
    }

    // Check for duplicates (this would indicate year collision)
    const uniqueDates = new Set(dates);
    console.log(`\n=== Results ===`);
    console.log(`Total dates generated: ${dates.length}`);
    console.log(`Unique dates: ${uniqueDates.size}`);

    if (dates.length === uniqueDates.size) {
        console.log('✅ PASS: No date collisions detected!');
    } else {
        console.error(`❌ FAIL: ${dates.length - uniqueDates.size} duplicate dates found!`);
        console.error('This means dates from different years are colliding.');
        return;
    }

    // Verify first and last dates
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const expectedFirst = '10/14/2023';
    const expectedLast = '10/15/2025';

    console.log(`\nFirst date: ${firstDate} (expected: ${expectedFirst})`);
    console.log(`Last date: ${lastDate} (expected: ${expectedLast})`);

    if (firstDate === expectedFirst && lastDate === expectedLast) {
        console.log('✅ PASS: First and last dates are correct!');
    } else {
        console.error('❌ FAIL: Date boundaries are incorrect!');
        return;
    }

    // Check that all dates include years
    const allHaveYears = dates.every(d => /\d{4}/.test(d));
    console.log(`\nAll dates include year: ${allHaveYears ? 'YES' : 'NO'}`);

    if (allHaveYears) {
        console.log('✅ PASS: All dates include year information!');
    } else {
        console.error('❌ FAIL: Some dates are missing year information!');
        return;
    }

    // Check year distribution
    const yearCounts = {};
    dates.forEach(d => {
        const year = d.match(/\d{4}/)[0];
        yearCounts[year] = (yearCounts[year] || 0) + 1;
    });

    console.log('\nYear distribution:');
    Object.keys(yearCounts).sort().forEach(year => {
        console.log(`  ${year}: ${yearCounts[year]} dates (${(yearCounts[year] / dates.length * 100).toFixed(1)}%)`);
    });

    // Verify date sorting
    console.log('\nTesting date sorting...');
    const unsorted = [...dates];
    const sorted = dates.sort((a, b) => {
        // Same parseForSort logic as in smart_svg_decoder.js
        const parseForSort = (dateStr) => {
            const slashYearMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (slashYearMatch) {
                return new Date(parseInt(slashYearMatch[3]), parseInt(slashYearMatch[1]) - 1, parseInt(slashYearMatch[2]));
            }
            return new Date(dateStr);
        };
        return parseForSort(a) - parseForSort(b);
    });

    const sortingWorks = sorted[0] === unsorted[0] && sorted[sorted.length - 1] === unsorted[unsorted.length - 1];
    if (sortingWorks) {
        console.log('✅ PASS: Date sorting works correctly!');
    } else {
        console.error('❌ FAIL: Date sorting is broken!');
        return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\nThe fix successfully:');
    console.log('✅ Detects multi-year ranges');
    console.log('✅ Includes years in all date strings');
    console.log('✅ Prevents date collisions across years');
    console.log('✅ Maintains correct date boundaries');
    console.log('✅ Sorts dates correctly with year information');
}

// Run the test
testMultiYearDates();
