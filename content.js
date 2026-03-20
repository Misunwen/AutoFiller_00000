// =========================================================================
// 🚀 搶票外掛 V3.6 終極典藏版 (支援: 拓元 tixCraft, ibon, KKTIX)
// =========================================================================

// === 狀態鎖 (通用) ===
let hasChecked = false;
let hasFilledQty = false;
let hasClickedZone = false; 

function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// 🔓 結界穿透演算法 【專武：ibon】
// 說明：ibon 的座位表隱藏在 <template shadowrootmode="open"> (Shadow DOM) 裡面。
// 傳統的 document.querySelector 完全找不到，必須用這招遞迴鑽進去抓。
function getAllElementsIncludingShadow() {
    const allElements = [];
    function traverse(root) {
        const elements = root.querySelectorAll('*');
        elements.forEach(el => {
            allElements.push(el);
            if (el.shadowRoot) traverse(el.shadowRoot); // 發現影子結界，鑽進去！
        });
    }
    traverse(document);
    return allElements;
}

// 💥 滅音狙擊點擊 【專武：拓元 tixCraft & ibon】
function stealthPhysicalClick(element) {
    try { 
        element.style.outline = "4px solid red"; 
        element.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
    } catch(e){}

    // 🎯 目標鎖定：
    // [拓元] 需要點擊 a, button
    // [ibon] 需要點擊 tr (整個表格列)
    let targetToClick = element.closest('a, button, [role="button"], .btn, tr, li') || element;

    console.log(`💥 [精準狙擊] 鎖定目標準備無聲開火!`, targetToClick);

    // ⚠️ 防火牆迴避 [拓元]：只發射單一點擊，避免一次發射太多點擊被 WAF 判定為機器人踢下線。
    try { window.HTMLElement.prototype.click.call(targetToClick); } catch(e) {}
    
    const events = ['pointerover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach(eventType => {
        try {
            const mouseEvent = new MouseEvent(eventType, {
                view: window, bubbles: true, cancelable: true, buttons: 1, detail: 1
            });
            targetToClick.dispatchEvent(mouseEvent);
        } catch(e) {}
    });
}

// ⌨️ 真人鍵盤輸入模擬器 【通用】
function simulateHumanInput(targetElement, value) {
    let prototype = targetElement.tagName.toLowerCase() === 'select' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    let nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if(nativeInputValueSetter) nativeInputValueSetter.call(targetElement, value);
    else targetElement.value = value;

    targetElement.dispatchEvent(new Event('focus', { bubbles: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
    targetElement.dispatchEvent(new Event('blur', { bubbles: true }));
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fillForm") {
        hasChecked = false; hasFilledQty = false; hasClickedZone = false;
        executeFillForm(request.settings);
    }
});

function executeFillForm(settings) {
    // === 1. 自動打勾條款 【通用：KKTIX / 拓元 / ibon 結帳頁】 ===
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

    // === 2. 🚦 購買階段感知系統 (全域數量填寫) 【專武：拓元 / ibon】 ===
    // 說明：一旦偵測到全域的「數量選單」，代表已經跳轉到結帳頁，這時會鎖死「尋找票區」功能，防止亂點。
    if (settings.dropdownValue !== "none" && !hasFilledQty) {
        let allElements = getAllElementsIncludingShadow();
        let targetElement = null;
        const keywords = ['qty', 'quantity', 'amount', 'ticketprice', 'volume', 'seatgrade', 'ticket_num', 'buynum'];

        for (let el of allElements) {
            let tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (tag === 'select' || (tag === 'input' && ['text', 'number', ''].includes(el.getAttribute('type') || ''))) {
                
                // ⚠️ 排除 KKTIX：因為 KKTIX 是「每個票區都有自己的數量框」，不能當作全域數量處理！
                if (el.closest('.ticket-unit, .display-table-row')) continue;

                let identifier = `${el.id} ${el.name} ${el.className} ${el.getAttribute('ng-model') || ''}`.toLowerCase();
                if (keywords.some(k => identifier.includes(k)) && !el.disabled) {
                    targetElement = el; break;
                }
            }
        }

        if (targetElement) {
            hasFilledQty = true;
            hasClickedZone = true; // 鎖定票區點擊
            if(targetElement.value !== settings.dropdownValue) {
                setTimeout(() => {
                    console.log(`🛒 [戰術待命] 已進入結帳階段！填寫數量：${settings.dropdownValue}`);
                    simulateHumanInput(targetElement, settings.dropdownValue);
                }, getRandomDelay(200, 400)); 
            }
        }
    }

    // === 3. 智慧尋找票區 【主戰場】 ===
    if (settings.autoClickZone && settings.zoneKeywords && !hasClickedZone) {
        const targetKeywords = settings.zoneKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

        if (targetKeywords.length > 0) {
            let allElements = getAllElementsIncludingShadow();
            let foundElement = null;

            for (let keyword of targetKeywords) {
                if (foundElement) break; 
                let cleanKeyword = keyword.toLowerCase().replace(/\s+/g, '');

                for (let el of allElements) {
                    if (['script', 'style', 'noscript', 'template'].includes(el.tagName.toLowerCase())) continue;

                    let text = "";
                    if (el.childNodes.length > 0) {
                        for (let child of el.childNodes) {
                            if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
                        }
                    } else {
                        text = el.textContent || '';
                    }
                    text = text.toLowerCase().replace(/\s+/g, '');
                    
                    if (text.includes(cleanKeyword)) {
                        // 📡 光學雷達：解決隱形元素問題
                        let rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            
                            let rawText = (el.textContent || '').trim();
                            
                            // 🚫 防誤點 1：字數超過 40 字，絕對是廢話說明文章 【防禦：拓元】
                            if (rawText.length > 40) continue;

                            // 🚫 防誤點 2：PDF與說明書過濾器 【防禦：ibon 身障表單 PDF】
                            let linkParent = el.closest('a');
                            if (linkParent && linkParent.href && linkParent.href.toLowerCase().includes('.pdf')) {
                                continue;
                            }
                            if (rawText.includes('表單') || rawText.includes('說明') || rawText.includes('流程') || rawText.includes('規定')) {
                                continue;
                            }

                            let tag = el.tagName.toLowerCase();
                            // 互動元素白名單：
                            // [拓元] a, button
                            // [ibon] tr, li
                            // [KKTIX] .ticket-unit, .display-table-row
                            let hasInteractiveParent = el.closest('a, button, [role="button"], tr, li, .ticket-unit, .display-table-row');
                            
                            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'strong', 'b', 'td', 'th', 'div'].includes(tag) && !hasInteractiveParent) {
                                continue; 
                            }

                            // 🚫 防護區鎖定：節目介紹與注意事項區塊，絕對不點 【防禦：拓元】
                            if (el.closest('#intro, #note, #buy-note, #get-note, #refund-note, .tab-content') && !el.closest('a, button')) {
                                continue; 
                            }

                            // 🦅 鷹眼避雷系統：檢查是否已售完 【通用】
                            let isSoldOut = false;
                            let rowContainer = el.closest('tr, li, .ticket-unit, div.zone-area'); 
                            let classString = (el.className + ' ' + (rowContainer ? rowContainer.className : '')).toLowerCase();
                            
                            // [ibon / KKTIX] 檢查 class 是否包含 disabled
                            if (classString.includes('disabled') || classString.includes('soldout')) {
                                isSoldOut = true;
                            }
                            // [拓元 / KKTIX] 檢查文字是否包含已售完
                            if (!isSoldOut && rowContainer) {
                                let rowText = rowContainer.textContent.replace(/\s+/g, '');
                                if (rowText.includes('已售完') || rowText.includes('售罄') || rowText.includes('缺貨')) {
                                    isSoldOut = true;
                                }
                            }

                            if (isSoldOut) {
                                console.log(`🚫 [鷹眼避雷] 該區已售完，繼續尋找...`);
                                continue; 
                            } else {
                                foundElement = el; // 🎯 完美通過所有安檢！
                                break; 
                            }
                        }
                    }
                }
            }

            // === 4. 執行戰術動作 (分歧點) ===
            if (foundElement) {
                // 嘗試尋找是不是 KKTIX 那種「每一行都有數量輸入框」的結構
                let rowContainer = foundElement.closest('.ticket-unit, .display-table-row');
                let rowQtyInput = null;
                
                if (rowContainer) {
                    rowQtyInput = rowContainer.querySelector('input:not([disabled]), select:not([disabled])');
                }

                if (rowQtyInput && settings.dropdownValue !== "none") {
                    // 🟢 【KKTIX 模式】：不用點擊跳轉，直接在同行輸入框填寫數量！
                    hasFilledQty = true; 
                    hasClickedZone = true;
                    setTimeout(() => {
                        simulateHumanInput(rowQtyInput, settings.dropdownValue);
                    }, getRandomDelay(200, 400));
                } else {
                    // 🔵 【拓元 / ibon 模式】：沒有數量輸入框，代表需要點擊按鈕/表格來跳轉下一頁！
                    hasClickedZone = true; 
                    setTimeout(() => {
                        stealthPhysicalClick(foundElement);
                    }, getRandomDelay(150, 300)); 
                }
            }
        }
    }
}

// === 自動重試機制 (迴圈引擎) ===
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

            if (allDone || attempts >= 80) { 
                clearInterval(intervalId);
            }
        }, 100); 
    });
}
window.addEventListener('load', startAutoFill);
