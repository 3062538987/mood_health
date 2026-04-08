-- wrk Lua 脚本：创建情绪记录
---@diagnostic disable: lowercase-global, undefined-global

wrk = wrk or {}
wrk.method = "POST"
wrk.headers = wrk.headers or {}
wrk.headers["Content-Type"] = "application/json"
wrk.headers["Authorization"] = "Bearer YOUR_TOKEN"

-- 随机生成情绪数据
local mood_types = {"happy", "sad", "anxious", "calm", "angry", "excited"}
local mood_contents = {
    "今天心情很好",
    "感到有些焦虑",
    "和朋友聊天很开心",
    "最近压力很大",
    "今天天气不错"
}

request = function()
    local mood_type = mood_types[math.random(#mood_types)]
    local mood_level = math.random(1, 5)
    local content = mood_contents[math.random(#mood_contents)]
    
    local body = string.format(
        '{"moodType":"%s","moodLevel":%d,"content":"%s","tags":["测试","压力测试"]}',
        mood_type, mood_level, content
    )
    
    return wrk.format(nil, nil, nil, body)
end

response = function(status, headers, body)
    if status ~= 200 then
        print("Error: " .. status)
    end
end
