// === 狀態鎖 ===
let hasChecked = false;
let hasFilledQty = false;
let hasClickedZone = false; 

function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// 🔓 萬能開鎖演算法：穿透 Shadow DOM
function getAllElementsIncludingShadow() {
    const allElements = [];
    function traverse(root) {
        const elements = root.querySelectorAll('*');
        elements.forEach(el => {
            allElements.push(el);
            if (el.shadowRoot) traverse(el.shadowRoot);
        });
    }
    traverse(document);
    return allElements;
}

// 🥷 隱匿刺客點擊：繞過 Anti-bot 監控
function stealthPhysicalClick(element) {
    let targetElement = element.closest('a') || element.closest('tr') || element;
    console.log(`🥷 準備暗殺目標:`, targetElement);

    try { window.HTMLElement.prototype.click.call(targetElement); } catch(e) {}

    const events = ['pointerover', 'pointerenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach(eventType => {
        try {
            const mouseEvent = new MouseEvent(eventType, {
                view: window, bubbles: true, cancelable: true, buttons: 1, detail: 1
            });
            targetElement.dispatchEvent(mouseEvent);
        } catch(e) {}
    });
}

// ⌨️ 真人鍵盤輸入模擬器 (對付 Angular/React)
function simulateHumanInput(targetElement, value) {
    let prototype = targetElement.tagName.toLowerCase() === 'select' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    
    // 底層寫入
    let nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if(nativeInputValueSetter) nativeInputValueSetter.call(targetElement, value);
    else targetElement.value = value;

    // 觸發全套事件
    targetElement.dispatchEvent(new Event('focus', { bubbles: true }));
    targetElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: value.toString() }));
    targetElement.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: value.toString() }));
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
    targetElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: value.toString() }));
    targetElement.dispatchEvent(new Event('blur', { bubbles: true }));
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fillForm") {
        hasChecked = false; 
        hasFilledQty = false;
        hasClickedZone = false;
        executeFillForm(request.settings);
    }
});

function executeFillForm(settings) {
    // === 1. 自動打勾條款 ===
    if (settings.autoCheck && !hasChecked) {
        let allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        const keywords = ['agree', 'term', 'accept', 'policy', 'condition', 'consent'];
        allCheckboxes.forEach(checkbox => {
            let identifier = `${checkbox.id} ${checkbox.className} ${checkbox.name} ${checkbox.value}`.toLowerCase();
            if (keywords.some(k => identifier.includes(k)) && !checkbox.checked) {
                hasChecked = true; 
                setTimeout(() => {
                    window.HTMLElement.prototype.click.call(checkbox);
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }, getRandomDelay(150, 300)); 
            }
        });
    }

    // === 2. 智慧尋找票區與處理數量 (支援 KKTIX 模式與傳統模式) ===
    if (settings.autoClickZone && settings.zoneKeywords && !hasClickedZone) {
        const targetKeywords = settings.zoneKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

        if (targetKeywords.length > 0) {
            let allElements = getAllElementsIncludingShadow();
            let foundElement = null;

            for (let keyword of targetKeywords) {
                if (foundElement) break; 
                let cleanKeyword = keyword.toLowerCase().replace(/\s+/g, '');
                let matches = []; 

                for (let el of allElements) {
                    let text = (el.textContent || '').toLowerCase().replace(/\s+/g, '');
                    if (text.includes(cleanKeyword)) {
                        if (['td', 'span', 'tr', 'button', 'a', 'div'].includes(el.tagName.toLowerCase())) {
                            matches.push(el);
                        }
                    }
                }

                if (matches.length > 0) {
                    foundElement = matches.find(el => el.tagName.toLowerCase() === 'a') 
                                || matches.find(el => el.tagName.toLowerCase() === 'td') 
                                || matches.find(el => el.tagName.toLowerCase() === 'span') 
                                || matches[0];
                    break; 
                }
            }

            if (foundElement) {
                hasClickedZone = true; 
                
                // 🕵️‍♂️ 檢查是否為 KKTIX 同列數量輸入模式
                // 往上找該票種的容器 (支援 KKTIX 的 .ticket-unit 或 .display-table-row)
                let rowContainer = foundElement.closest('.ticket-unit, .display-table-row, tr, li');
                let rowQtyInput = null;
                
                if (rowContainer) {
                    // 在這行裡面找輸入框或下拉選單 (必須是未禁用的，代表沒售完)
                    rowQtyInput = rowContainer.querySelector('input:not([disabled]), select:not([disabled])');
                }

                if (rowQtyInput && settings.dropdownValue !== "none") {
                    // 🎯 KKTIX 模式：直接在這行填入數量
                    console.log(`🎯 [KKTIX模式] 發現同行數量輸入框！準備填入: ${settings.dropdownValue}`);
                    hasFilledQty = true; // 既然直接填了，全域數量搜尋就不必做了
                    setTimeout(() => {
                        simulateHumanInput(rowQtyInput, settings.dropdownValue);
                        console.log(`🎫 專屬票區數量已設定為: ${settings.dropdownValue}`);
                    }, getRandomDelay(200, 400));
                } else {
                    // ⚔️ 傳統模式 (前兩個網站)：執行點擊
                    setTimeout(() => {
                        stealthPhysicalClick(foundElement);
                        console.log(`🤖 [點擊模式] 刺客已執行任務：觸發目標 [${foundElement.textContent.trim()}]`);
                    }, getRandomDelay(200, 400)); 
                }
            }
        }
    }

    // === 3. 獨立全域數量處理 (給非 KKTIX 網站使用) ===
    if (settings.dropdownValue !== "none" && !hasFilledQty) {
        let allElements = getAllElementsIncludingShadow();
        let targetElement = null;
        const keywords = ['qty', 'quantity', 'amount', 'ticketprice', 'volume', 'seatgrade'];

        for (let el of allElements) {
            let tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (tag === 'select' || (tag === 'input' && ['text', 'number', ''].includes(el.getAttribute('type') || ''))) {
                let identifier = `${el.id} ${el.name} ${el.className} ${el.getAttribute('ng-model') || ''}`.toLowerCase();
                if (keywords.some(k => identifier.includes(k)) && !el.disabled) {
                    targetElement = el; break;
                }
            }
        }

        if (targetElement) {
            if(targetElement.value === settings.dropdownValue) {
                hasFilledQty = true; return;
            }
            hasFilledQty = true;
            setTimeout(() => {
                simulateHumanInput(targetElement, settings.dropdownValue);
                console.log(`🎫 全域數量已設定為: ${settings.dropdownValue}`);
            }, getRandomDelay(400, 700)); 
        }
    }
}

// === 自動重試機制 ===
function startAutoFill() {
    chrome.storage.sync.get(['autoCheck', 'dropdownValue', 'autoClickZone', 'zoneKeywords'], function(data) {
        let attempts = 0;
        let intervalId = setInterval(() => {
            attempts++;
            executeFillForm(data);
            
            let allDone = true;
            if (data.autoCheck && !hasChecked) allDone = false;
            if (data.dropdownValue !== "none" && !hasFilledQty) allDone = false;
            if (data.autoClickZone && data.zoneKeywords && !hasClickedZone) allDone = false;

            if (allDone || attempts >= 100) {
                clearInterval(intervalId);
            }
        }, 100); 
    });
}

window.addEventListener('load', startAutoFill);
