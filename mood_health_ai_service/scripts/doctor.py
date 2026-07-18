#!/usr/bin/env python3
"""
环境检查工具 — 验证 FastAPI 服务运行所需的所有依赖。
检查项: Python 版本、Python 包、Node 版本、MySQL、Redis、环境变量。
"""

import sys
import os
import subprocess
from pathlib import Path


def check(msg: str, ok: bool) -> bool:
    status = "OK" if ok else "FAIL"
    print(f"  [{status}] {msg}")
    return ok


def main():
    errors = 0
    root = Path(__file__).parent.parent.parent
    ai_dir = root / "mood_health_ai_service"
    node_dir = root / "mood_health_server"

    print("=== 环境检查 (Doctor) ===\n")

    # 1. 脚本路径
    print(f"项目根目录: {root}")
    print(f"AI 服务目录: {ai_dir}")
    print(f"Node 服务目录: {node_dir}")
    print()

    # 2. Python
    print("--- Python ---")
    py_ver = sys.version_info
    if not check(f"Python >= 3.10 (当前 {py_ver.major}.{py_ver.minor}.{py_ver.micro})", py_ver >= (3, 10)):
        errors += 1

    # 3. Python 包
    print("\n--- Python 包 ---")
    pkgs = {
        "fastapi": "fastapi",
        "uvicorn": "uvicorn",
        "pydantic": "pydantic",
        "httpx": "httpx",
        "openai": "openai",
        "pydantic-settings": "pydantic_settings",
    }
    for name, module in pkgs.items():
        try:
            __import__(module)
            check(name, True)
        except ImportError:
            check(name, False)
            errors += 1

    # 4. Node
    print("\n--- Node.js ---")
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=10)
        node_ver = result.stdout.strip()
        check(f"Node.js ({node_ver})", result.returncode == 0)
    except Exception:
        check("Node.js", False)
        errors += 1

    # 5. MySQL
    print("\n--- MySQL ---")
    mysql_host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    mysql_port = os.environ.get("MYSQL_PORT", "3306")
    print(f"  配置: {mysql_host}:{mysql_port}")
    try:
        import mysql.connector
        check("mysql-connector-python 已安装", True)
    except ImportError:
        check("mysql-connector-python", False)
        errors += 1

    # 6. Redis
    print("\n--- Redis ---")
    redis_host = os.environ.get("REDIS_HOST", "127.0.0.1")
    redis_port = os.environ.get("REDIS_PORT", "6379")
    print(f"  配置: {redis_host}:{redis_port}")
    try:
        import redis
        check("redis-py 已安装", True)
    except ImportError:
        check("redis-py", False)
        errors += 1

    # 7. 环境变量
    print("\n--- 环境变量 ---")
    required_env = [
        "AI_SERVICE_INTERNAL_TOKEN",
        "AI_API_KEY",
    ]
    optional_env = [
        "MYSQL_HOST",
        "MYSQL_PORT",
        "MYSQL_USER",
        "MYSQL_PASSWORD",
        "MYSQL_DATABASE",
        "REDIS_HOST",
        "REDIS_PORT",
        "REDIS_PASSWORD",
        "AI_BASE_URL",
        "AI_MODEL",
        "MOOD_AI_SERVICE_PORT",
        "FASTAPI_BASE_URL",
    ]
    for key in required_env:
        val = os.environ.get(key, "")
        check(f"{key}={'***' if val else '(未设置)'}", bool(val))
        if not val:
            errors += 1

    for key in optional_env:
        val = os.environ.get(key, "")
        status = "已设置" if val else "使用默认值"
        print(f"  [INFO] {key}: {status}")

    # 8. .env 文件
    print("\n--- .env 文件 ---")
    env_file = root / ".env"
    if env_file.exists():
        check(f".env 文件存在 ({env_file})", True)
    else:
        check(".env 文件不存在", False)
        print(f"  提示: 复制 .env.example 为 .env 并填写配置")
        errors += 1

    # 总结
    print(f"\n=== 检查完成: {errors} 个错误 ===")
    if errors > 0:
        print("请修复上述错误后重新运行。")
        sys.exit(1)
    else:
        print("环境就绪，可以启动服务。")


if __name__ == "__main__":
    main()