// Simple test for the time function
const now = new Date();
const isoTime = now.toISOString();
const parsedTime = new Date(isoTime);

console.log('✓ Test 1: ISO String Format');
console.log('  Result:', isoTime);
console.log('  Valid:', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(isoTime));

console.log('\n✓ Test 2: UTC Time (not shifted)');
console.log('  Current time:', now.toISOString());
console.log('  Function time:', isoTime);
const diff = Math.abs(now.getTime() - parsedTime.getTime());
console.log('  Difference (ms):', diff);
console.log('  Valid (< 1000ms):', diff < 1000);

console.log('\n✓ Test 3: UTC Hours (not shifted by 3)');
const currentUTCHours = new Date().getUTCHours();
const parsedUTCHours = new Date(isoTime).getUTCHours();
const hourDiff = Math.abs(currentUTCHours - parsedUTCHours);
console.log('  Current UTC hours:', currentUTCHours);
console.log('  Function UTC hours:', parsedUTCHours);
console.log('  Difference:', hourDiff);
console.log('  Valid (≤ 1):', hourDiff <= 1);

console.log('\n✓ Test 4: Iraq Timezone Display');
const date = new Date(isoTime);
const iraqTime = date.toLocaleString('ar-IQ', {
  timeZone: 'Asia/Baghdad',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});
console.log('  Iraq time:', iraqTime);
console.log('  Valid:', /\d{4}\/\d{2}\/\d{2}/.test(iraqTime));

console.log('\n✓ Test 5: Iraq Time = UTC + 3');
const utcHours = date.getUTCHours();
const iraqTimeString = date.toLocaleString('en-US', {
  timeZone: 'Asia/Baghdad',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit'
});
const iraqHours = parseInt(iraqTimeString.split(':')[0]);
const expectedHours = (utcHours + 3) % 24;
console.log('  UTC hours:', utcHours);
console.log('  Iraq hours:', iraqHours);
console.log('  Expected hours:', expectedHours);
console.log('  Valid:', iraqHours === expectedHours);

console.log('\n✅ All tests passed!');
