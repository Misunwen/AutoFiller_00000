// 加入防護鎖，確保不會因為重試機制而重複執行
let hasChecked = false;
let hasFilledQty = false;

// 產生隨機延遲時間的函數 (模擬人類反應時間)
function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fillForm") {
        hasChecked = false; // 手動點擊時重置鎖
        hasFilledQty = false;
        executeFillForm(request.settings);
    }
});

function executeFillForm(settings) {
    // === 1. 處理自動打勾 ===
    if (settings.autoCheck && !hasChecked) {
        let allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        const keywords = ['agree', 'term', 'accept', 'policy', 'condition', 'consent'];

        allCheckboxes.forEach(checkbox => {
            let identifier = `${checkbox.id} ${checkbox.className} ${checkbox.name} ${checkbox.value}`.toLowerCase();
            if (keywords.some(k => identifier.includes(k)) && !checkbox.checked) {
                
                hasChecked = true; // 上鎖，避免重複觸發
                
                setTimeout(() => {
                    checkbox.click(); 
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log("🤖 擬人化防護：已勾選同意條款");
                }, getRandomDelay(200, 400)); 
            }
        });
    }

    // === 2. 處理數量填寫 (地毯式搜索 + 擴充關鍵字) ===
    if (settings.dropdownValue !== "none" && !hasFilledQty) {
        let targetElement = null;
        let allSelects = document.querySelectorAll('select');
        let allInputs = document.querySelectorAll('input[type="text"], input:not([type]), input[type="number"]');
        
        // 🎯 【關鍵升級】在這裡加入了 'volume' 和 'seatgrade'
        const keywords = ['qty', 'quantity', 'amount', 'ticketprice', 'volume', 'seatgrade'];

        // 尋找 Select 下拉選單
        for (let sel of allSelects) {
            let identifier = `${sel.id} ${sel.name} ${sel.className}`.toLowerCase();
            if (keywords.some(k => identifier.includes(k)) && !sel.disabled && sel.offsetParent !== null) {
                targetElement = sel; 
                break; // 找到第一個就鎖定
            }
        }

        // 尋找 Input 輸入框
        if (!targetElement) {
            for (let inp of allInputs) {
                let identifier = `${inp.id} ${inp.name} ${inp.className} ${inp.getAttribute('ng-model') || ''}`.toLowerCase();
                if (keywords.some(k => identifier.includes(k)) && !inp.disabled && inp.offsetParent !== null) {
                    targetElement = inp; 
                    break;
                }
            }
        }

        if (targetElement) {
            if(targetElement.value === settings.dropdownValue) {
                hasFilledQty = true;
                return;
            }

            hasFilledQty = true; // 上鎖

            setTimeout(() => {
                let prototype = targetElement.tagName.toLowerCase() === 'select' 
                    ? window.HTMLSelectElement.prototype 
                    : window.HTMLInputElement.prototype;

                // 1. 標準賦值
                targetElement.value = settings.dropdownValue;
                
                // 2. 繞過框架攔截
                let nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
                if(nativeInputValueSetter) {
                    nativeInputValueSetter.call(targetElement, settings.dropdownValue);
                }

                // 3. 觸發所有事件 (包含這個網頁特有的 onchange="sltTicket(...)")
                targetElement.dispatchEvent(new Event('focus', { bubbles: true }));
                targetElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: settings.dropdownValue }));
                targetElement.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: settings.dropdownValue }));
                targetElement.dispatchEvent(new Event('input', { bubbles: true }));
                targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                targetElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: settings.dropdownValue }));
                targetElement.dispatchEvent(new Event('blur', { bubbles: true }));
                
                console.log("🤖 擬人化防護：已填寫數量 " + settings.dropdownValue);
            }, getRandomDelay(300, 600)); 
        }
    }
}

// === 自動重試機制 ===
function startAutoFill() {
    chrome.storage.sync.get(['autoCheck', 'dropdownValue'], function(data) {
        let attempts = 0;
        let intervalId = setInterval(() => {
            attempts++;
            executeFillForm(data);
            
            // 如果兩件事都做完了，或者嘗試超過 50 次 (5秒)，就停止偵測
            if ((hasChecked && hasFilledQty) || attempts >= 50) {
                clearInterval(intervalId);
            }
        }, 100); 
    });
}

window.addEventListener('load', startAutoFill);
