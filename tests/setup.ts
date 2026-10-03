// Pin the timezone so date maths behaves identically on every machine. New
// Zealand observes daylight saving, so the 23- and 25-hour days around its
// changeovers are genuinely exercised rather than skipped on a UTC machine.
process.env.TZ = 'Pacific/Auckland';
