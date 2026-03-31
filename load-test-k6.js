import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');
const messageSendDuration = new Trend('message_send_duration');
const pageLoadFails = new Counter('page_load_fails');

export const options = {
  // Scenario 1: Dashboard users
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Go to 100 users
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 0 },    // Ramp down
  ],
  
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'errors': ['rate<0.01'],
    'login_duration': ['p(95)<300'],
    'dashboard_duration': ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api/v1';
const EMAIL = __ENV.EMAIL || 'test@example.com';
const PASSWORD = __ENV.PASSWORD || 'TestPassword123!';

let authToken = '';

export function setup() {
  // Login once to get auth token for all users
  const payload = JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/auth/login`, payload, params);
  
  if (res.status === 200) {
    const data = JSON.parse(res.body);
    return { token: data.data.token, orgId: data.data.org.id };
  }
  
  throw new Error(`Failed to get auth token: ${res.status}`);
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  group('Scenario 1: Dashboard & Inbox', () => {
    // Load dashboard
    const dashStart = new Date();
    const dashRes = http.get(`${BASE_URL}/analytics/overview`, {
      headers,
    });
    dashboardDuration.add(new Date() - dashStart);

    check(dashRes, {
      'dashboard status is 200': (r) => r.status === 200,
      'dashboard response < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    // Load inbox conversations
    const inboxRes = http.get(`${BASE_URL}/inbox/conversations?limit=50&offset=0`, {
      headers,
    });

    check(inboxRes, {
      'inbox status is 200': (r) => r.status === 200,
      'inbox response < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    // Load messages for first conversation
    if (inboxRes.status === 200) {
      const conversations = JSON.parse(inboxRes.body).data;
      if (conversations.length > 0) {
        const convoId = conversations[0].id;
        http.get(`${BASE_URL}/inbox/messages/${convoId}?limit=20&offset=0`, {
          headers,
        });
      }
    }
  });

  group('Scenario 2: Device Operations', () => {
    const devicesRes = http.get(`${BASE_URL}/devices?limit=20`, {
      headers,
    });

    check(devicesRes, {
      'devices list status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  group('Scenario 3: Contacts & Search', () => {
    const contactsRes = http.get(`${BASE_URL}/contacts?status=active&limit=50`, {
      headers,
    });

    check(contactsRes, {
      'contacts list status 200': (r) => r.status === 200,
      'contacts response < 300ms': (r) => r.timings.duration < 300,
    }) || errorRate.add(1);
  });

  group('Scenario 4: Settings', () => {
    const settingsRes = http.get(`${BASE_URL}/settings/org`, {
      headers,
    });

    check(settingsRes, {
      'settings status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    // Get team members
    http.get(`${BASE_URL}/settings/team/members`, {
      headers,
    });
  });

  // Simulate realistic user behavior
  __VU % 4 === 0 && group('Scenario 5: Message Sending', () => {
    const msgStart = new Date();
    const msgRes = http.post(
      `${BASE_URL}/messages/send`,
      JSON.stringify({
        deviceId: 'test-device',
        to: '1234567890',
        text: 'Test message from load test',
      }),
      { headers }
    );
    messageSendDuration.add(new Date() - msgStart);

    check(msgRes, {
      'message send status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  __VU % 10 === 0 && group('Scenario 6: Template Operations', () => {
    http.get(`${BASE_URL}/templates?limit=20`, {
      headers,
    });

    // Create a new template
    http.post(
      `${BASE_URL}/templates`,
      JSON.stringify({
        name: `Test Template ${__VU}-${__ITER}`,
        content: 'Hello {{name}}, welcome!',
        category: 'greeting',
      }),
      { headers }
    );
  });
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', lineWidth: 80 }),
    'output.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options?.indent || '';
  const lineWidth = options?.lineWidth || 80;

  let summary = '\n\n=== LOAD TEST SUMMARY ===\n';
  
  if (data.metrics.errors) {
    summary += `\nError Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`;
  }

  summary += `\n\nThrough JSON:\n${JSON.stringify(data, null, 2)}`;
  
  return summary;
}
