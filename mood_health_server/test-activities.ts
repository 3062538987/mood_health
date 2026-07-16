const BASE_URL = "http://localhost:3000/api";

let token: string | null = null;

async function register() {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "activityuser",
      password: "password123",
      email: "activity@example.com",
    }),
  });
  const data = (await response.json()) as any;
  console.log("注册结果:", data);
  return data;
}

async function login() {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "activityuser",
      password: "password123",
    }),
  });
  const data = (await response.json()) as any;
  console.log("登录结果:", data);
  token = data.token;
  return data;
}

async function getActivities() {
  const response = await fetch(`${BASE_URL}/activities/list?page=1&limit=10`);
  const data = await response.json();
  console.log("活动列表:", data);
  return data;
}

async function getActivityDetail(id: number) {
  const response = await fetch(`${BASE_URL}/activities/detail/${id}`);
  const data = await response.json();
  console.log(`活动详情 (ID: ${id}):`, data);
  return data;
}

async function joinActivity(id: number) {
  const response = await fetch(`${BASE_URL}/activities/join/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  console.log(`报名活动 (ID: ${id}):`, data);
  return data;
}

async function getMyJoinedActivities() {
  const response = await fetch(`${BASE_URL}/activities/my-joined`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  console.log("我已报名的活动:", data);
  return data;
}

async function main() {
  try {
    console.log("\n=== 开始测试活动接口 ===\n");

    console.log("1. 注册用户...");
    await register();

    console.log("\n2. 登录获取 token...");
    await login();

    console.log("\n3. 获取活动列表...");
    await getActivities();

    console.log("\n4. 获取活动详情 (ID: 1)...");
    await getActivityDetail(1);

    console.log("\n5. 报名活动 (ID: 1)...");
    await joinActivity(1);

    console.log("\n6. 获取我已报名的活动...");
    await getMyJoinedActivities();

    console.log("\n7. 测试重复报名 (ID: 1)...");
    await joinActivity(1);

    console.log("\n8. 报名另一个活动 (ID: 2)...");
    await joinActivity(2);

    console.log("\n9. 再次获取我已报名的活动...");
    await getMyJoinedActivities();

    console.log("\n=== 测试完成 ===\n");
  } catch (error) {
    console.error("测试失败:", error);
  }
}

main();
