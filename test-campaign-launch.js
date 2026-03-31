// Test script to verify campaign launch fixes
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api/v1';

async function testCampaignLaunch() {
  console.log('🧪 Testing campaign launch fixes...\n');
  
  // 1. Check debug endpoint
  console.log('1. Checking debug endpoint...');
  try {
    const debugRes = await fetch(`${API_BASE}/debug`);
    const debugData = await debugRes.json();
    console.log('✅ Debug endpoint works');
    console.log(`   - Active sessions: ${debugData.activeSessions}`);
    console.log(`   - DB devices: ${debugData.dbDevices?.length || 0}`);
    console.log(`   - Mismatches: ${debugData.mismatch?.length || 0}`);
    if (debugData.mismatch?.length > 0) {
      console.log('   ⚠️  Session/DB mismatch detected - devices need reconnection');
    }
  } catch (err) {
    console.log('❌ Debug endpoint failed:', err.message);
  }
  
  console.log('\n2. Test completed!');
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Open http://localhost:3002 in your browser');
  console.log('2. Go to Devices page and reconnect any devices that show as Connected but have no session');
  console.log('3. Create a test campaign with a few contacts');
  console.log('4. Launch the campaign and check the backend logs for sending activity');
  console.log('5. Verify messages are actually sent (not just 0 messages)');
}

testCampaignLaunch().catch(console.error);
