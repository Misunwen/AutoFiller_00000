// =========================================================================
// 🕵️‍♂️ [內部特工] inject.js - 潛伏在網頁主世界，負責執行被封鎖的指令
// =========================================================================

window.addEventListener('message', function(event) {
    // 收到來自 content.js 的暗號
    if (event.data && event.data.type === 'EXECUTE_IBON') {
        let href = event.data.script;
        console.log("🕵️‍♂️ [內部特工] 收到暗號，準備執行原生腳本:", href);
        
        // 針對 ibon 的 Send 函數進行特化拆解
        let match = href.match(/Send\((.*?)\)/i);
        if (match && typeof window.Send === 'function') {
            try {
                // 把參數拆出來：'0205', 'B0AMVW8Z', ...
                let args = match[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                console.log("🕵️‍♂️ [內部特工] 完美偽裝！呼叫網頁原生 Send，參數:", args);
                
                // 直接執行網頁自己的函數，繞過所有 CSP 限制！
                window.Send(...args);
            } catch (e) {
                console.log("❌ [內部特工] 執行失敗:", e);
            }
        } else {
            // 如果不是 Send 函數，嘗試直接跳轉
            window.location.href = href;
        }
    }
});
