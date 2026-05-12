(function() {
    const TOKEN = '__BOT_IBON__';
    window.addEventListener("message", function(n) {
        if (!n.data || n.data.type !== TOKEN) return;
        var script = n.data.script;
        console.log('[inject] 收到指令:', script);
        var m = script.match(/Send\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/i);
        if (m && typeof window.Send === 'function') {
            try {
                var args = (new Function('return [' + m[1] + ']'))();
                console.log('[inject] 執行 Send, args:', args);
                window.Send.apply(window, args);
                return;
            } catch(e) {
                console.log('[inject] Send 失敗:', e.message);
            }
        }
        try {
            eval(script);
            return;
        } catch(e) {
            console.log('[inject] eval 失敗:', e.message);
        }
        console.log('[inject] 所有方法失敗');
    });
    console.log('[inject] ✅ 已就緒 TOKEN=' + TOKEN);
})();
