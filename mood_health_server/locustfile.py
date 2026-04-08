"""
压力测试脚本 - 使用 Locust 测试大学生情绪健康管理平台

安装依赖：
pip install locust

运行测试：
locust -f locustfile.py --host=http://localhost:3000

访问 Web UI：
http://localhost:8089

命令行模式（无 Web UI）：
locust -f locustfile.py --host=http://localhost:3000 --headless -u 100 -r 10 -t 60s
"""

from locust import HttpUser, task, between
import random
import json


class MoodHealthUser(HttpUser):
    """
    模拟大学生情绪健康管理平台的用户行为
    """
    wait_time = between(1, 3)  # 用户操作间隔 1-3 秒
    
    def on_start(self):
        """用户开始时执行：登录获取 token"""
        self.token = None
        self.user_id = None
        self.mood_ids = []
        self.login()
    
    def login(self):
        """用户登录"""
        # 使用测试账号登录
        login_data = {
            "username": f"testuser{random.randint(1, 100)}",
            "password": "testpassword123"
        }
        
        response = self.client.post("/api/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == 0:
                self.token = data.get("data", {}).get("token")
                self.user_id = data.get("data", {}).get("userId")
                print(f"登录成功: {login_data['username']}")
        else:
            # 如果登录失败，尝试注册
            self.register(login_data)
    
    def register(self, login_data):
        """用户注册"""
        register_data = {
            **login_data,
            "email": f"{login_data['username']}@test.com",
            "nickname": f"测试用户{random.randint(1, 100)}"
        }
        
        response = self.client.post("/api/auth/register", json=register_data)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == 0:
                self.token = data.get("data", {}).get("token")
                self.user_id = data.get("data", {}).get("userId")
                print(f"注册成功: {login_data['username']}")
    
    def get_headers(self):
        """获取认证请求头"""
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}
    
    @task(10)
    def get_mood_list(self):
        """获取情绪列表（高频操作）"""
        params = {
            "page": random.randint(1, 5),
            "pageSize": 20
        }
        
        self.client.get(
            "/api/moods",
            params=params,
            headers=self.get_headers(),
            name="/api/moods [获取情绪列表]"
        )
    
    @task(5)
    def create_mood_record(self):
        """创建情绪记录（中频操作）"""
        mood_types = ["happy", "sad", "anxious", "calm", "angry", "excited"]
        mood_data = {
            "moodType": random.choice(mood_types),
            "moodLevel": random.randint(1, 5),
            "content": f"测试情绪记录 {random.randint(1, 1000)}",
            "tags": ["测试", "压力测试"]
        }
        
        response = self.client.post(
            "/api/moods",
            json=mood_data,
            headers=self.get_headers(),
            name="/api/moods [创建情绪记录]"
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == 0:
                mood_id = data.get("data", {}).get("id")
                if mood_id:
                    self.mood_ids.append(mood_id)
    
    @task(3)
    def get_weekly_report(self):
        """获取情绪周报（中频操作）"""
        self.client.get(
            "/api/moods/weekly-report",
            headers=self.get_headers(),
            name="/api/moods/weekly-report [获取周报]"
        )
    
    @task(3)
    def get_mood_trend(self):
        """获取情绪趋势（中频操作）"""
        params = {
            "days": random.choice([7, 14, 30])
        }
        
        self.client.get(
            "/api/moods/trend",
            params=params,
            headers=self.get_headers(),
            name="/api/moods/trend [获取趋势]"
        )
    
    @task(2)
    def update_mood_record(self):
        """更新情绪记录（低频操作）"""
        if not self.mood_ids:
            return
        
        mood_id = random.choice(self.mood_ids)
        update_data = {
            "moodType": "happy",
            "moodLevel": random.randint(1, 5),
            "content": f"更新后的情绪记录 {random.randint(1, 1000)}",
            "tags": ["测试", "更新"]
        }
        
        self.client.put(
            f"/api/moods/{mood_id}",
            json=update_data,
            headers=self.get_headers(),
            name="/api/moods/:id [更新情绪记录]"
        )
    
    @task(1)
    def delete_mood_record(self):
        """删除情绪记录（低频操作）"""
        if not self.mood_ids:
            return
        
        mood_id = self.mood_ids.pop()
        
        self.client.delete(
            f"/api/moods/{mood_id}",
            headers=self.get_headers(),
            name="/api/moods/:id [删除情绪记录]"
        )
    
    @task(5)
    def get_posts(self):
        """获取树洞帖子列表（中频操作）"""
        params = {
            "page": random.randint(1, 5),
            "pageSize": 20
        }
        
        self.client.get(
            "/api/posts",
            params=params,
            headers=self.get_headers(),
            name="/api/posts [获取帖子列表]"
        )
    
    @task(2)
    def create_post(self):
        """发布树洞帖子（低频操作）"""
        post_data = {
            "content": f"测试树洞帖子 {random.randint(1, 1000)}",
            "isAnonymous": random.choice([True, False])
        }
        
        self.client.post(
            "/api/posts",
            json=post_data,
            headers=self.get_headers(),
            name="/api/posts [发布帖子]"
        )
    
    @task(3)
    def get_activities(self):
        """获取活动列表（中频操作）"""
        params = {
            "page": 1,
            "pageSize": 10
        }
        
        self.client.get(
            "/api/activities",
            params=params,
            headers=self.get_headers(),
            name="/api/activities [获取活动列表]"
        )
    
    @task(2)
    def get_questionnaires(self):
        """获取问卷列表（低频操作）"""
        self.client.get(
            "/api/questionnaires",
            headers=self.get_headers(),
            name="/api/questionnaires [获取问卷列表]"
        )


class AIAnalysisUser(HttpUser):
    """
    模拟 AI 情绪分析服务的用户行为
    测试 FastAPI AI 服务（端口 8000）
    """
    wait_time = between(2, 5)  # AI 分析间隔更长
    
    @task(10)
    def analyze_mood(self):
        """AI 情绪分析（主要操作）"""
        contents = [
            "今天心情很好，完成了很多工作",
            "感到有些焦虑，明天有考试",
            "和朋友聊天很开心",
            "最近压力很大，需要放松",
            "今天天气不错，心情愉悦"
        ]
        
        analysis_data = {
            "content": random.choice(contents),
            "mood_level": random.randint(1, 5)
        }
        
        # 注意：这里直接访问 FastAPI 服务（端口 8000）
        # 如果通过 Nginx 代理，则使用 /api/ai/analyze-mood
        self.client.post(
            "/api/analyze-mood",
            json=analysis_data,
            name="/api/analyze-mood [AI 情绪分析]"
        )
    
    @task(1)
    def health_check(self):
        """健康检查（低频操作）"""
        self.client.get(
            "/health",
            name="/health [健康检查]"
        )


# 测试配置示例
"""
# Web UI 模式
locust -f locustfile.py --host=http://localhost:3000

# 命令行模式 - 测试 Node.js 后端
locust -f locustfile.py --host=http://localhost:3000 --headless \
    -u 50 -r 5 -t 120s --only-summary

# 命令行模式 - 测试 AI 服务
locust -f locustfile.py --host=http://localhost:8000 --headless \
    -u 10 -r 2 -t 60s --only-summary AIAnalysisUser

# 分布式测试（主节点）
locust -f locustfile.py --master

# 分布式测试（工作节点）
locust -f locustfile.py --worker --master-host=<master-ip>

# 参数说明：
# -u, --users: 总用户数
# -r, --spawn-rate: 每秒启动的用户数
# -t, --run-time: 运行时间（如 60s, 5m, 1h）
# --headless: 无 Web UI 模式
# --only-summary: 只显示最终摘要
# -H, --host: 目标服务器地址
"""
