-- wrk Lua 脚本：AI 情绪分析

wrk.method = "POST"
wrk.headers["Content-Type"] = "application/json"

-- 随机生成情绪描述
local contents = {
    "今天心情很好，完成了很多工作",
    "感到有些焦虑，明天有考试",
    "和朋友聊天很开心",
    "最近压力很大，需要放松",
    "今天天气不错，心情愉悦"
}

request = function()
    local content = contents[math.random(#contents)]
    local mood_level = math.random(1, 5)
    
    local body = string.format(
        '{"content":"%s","mood_level":%d}',
        content, mood_level
    )
    
    return wrk.format(nil, nil, nil, body)
end

response = function(status, headers, body)
    if status ~= 200 then
        print("Error: " .. status)
    end
end
