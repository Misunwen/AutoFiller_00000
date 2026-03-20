// =========================================================================
// 🚀 搶票外掛 V5.1 - 拓元精準鎖定版 (IBON & 拓元 雙殺)
// =========================================================================

let hasChecked = false;
let hasFilledQty = false;
let hasClickedZone = false; 

function getRandomDelay(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }

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

function stealthPhysicalClick(element) {
    // 🎯 拓元修復核心：穿甲彈邏輯
    // 1. 往上找：看看是不是點到了按鈕裡面的字 (例如 <span>)
    let targetToClick = element.closest('a, button, [role="button"], area');
    
    // 2. 往下找：如果是被 <ul> 或 <li> 這種大外框騙了，就直接往裡面挖出 <a> 按鈕！
    if (!targetToClick) {
        targetToClick = element.querySelector('a, button, [role="button"], area') || element;
    }

    try { 
        targetToClick.style.outline = "4px solid red"; 
        targetToClick.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
    } catch(e){}

    console.log(`💥 [精準狙擊] 鎖定目標準備開火!`, targetToClick);

    // 🕵️‍♂️ 遇到 javascript: 連結，發送暗號給主世界特工 (專治 ibon)
    let hrefAttr = targetToClick.getAttribute('href') || targetToClick.href || "";
    if (hrefAttr.toLowerCase().includes('javascript:')) {
        console.log("⚡ [系統] 觸發 CSP 防護，呼叫特工執行暗號...");
        window.postMessage({ type: 'EXECUTE_IBON', script: hrefAttr }, '*');
        return; 
    }

    // 常規物理點擊 (專治拓元、KKTIX)
    try { targetToClick.click(); } catch(e) {}
    try { window.HTMLElement.prototype.click.call(targetToClick); } catch(e) {}
    const events = ['pointerover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach(eventType => {
        try { targetToClick.dispatchEvent(new MouseEvent(eventType, { view: window, bubbles: true, cancelable: true, buttons: 1, detail: 1 })); } catch(e) {}
    });
}

function simulateHumanInput(targetElement, value) {
    let prototype = targetElement.tagName.toLowerCase() === 'select' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    let nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if(nativeInputValueSetter) nativeInputValueSetter.call(targetElement, value);
    else targetElement.value = value;
    targetElement.dispatchEvent(new Event('focus', { bubbles: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
    targetElement.dispatchEvent(new Event('blur', { bubbles: true }));
}

function executeFillForm(settings) {
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

    if (settings.dropdownValue !== "none" && !hasFilledQty) {
        let allElements = getAllElementsIncludingShadow();
        let targetElement = null;
        const keywords = ['qty', 'quantity', 'amount', 'ticketprice', 'volume', 'seatgrade', 'ticket_num', 'buynum'];
        for (let el of allElements) {
            let tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (tag === 'select' || (tag === 'input' && ['text', 'number', ''].includes(el.getAttribute('type') || ''))) {
                if (el.closest('.ticket-unit, .display-table-row')) continue;
                let identifier = `${el.id} ${el.name} ${el.className} ${el.getAttribute('ng-model') || ''}`.toLowerCase();
                if (keywords.some(k => identifier.includes(k)) && !el.disabled) { targetElement = el; break; }
            }
        }
        if (targetElement) {
            hasFilledQty = true;
            hasClickedZone = true;
            if(targetElement.value !== settings.dropdownValue) {
                setTimeout(() => {
                    console.log(`🛒 [戰術待命] 已進入結帳階段！填寫數量：${settings.dropdownValue}`);
                    simulateHumanInput(targetElement, settings.dropdownValue);
                }, getRandomDelay(200, 400)); 
            }
        }
    }

    if (settings.autoClickZone && settings.zoneKeywords && !hasClickedZone) {
        const targetKeywords = settings.zoneKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

        if (targetKeywords.length > 0) {
            let allElements = getAllElementsIncludingShadow();
            let foundElement = null;

            for (let keyword of targetKeywords) {
                if (foundElement) break; 
                let cleanKeyword = keyword.toLowerCase().replace(/\s+/g, '');
                let possibleMatches = []; 

                for (let el of allElements) {
                    let tag = el.tagName ? el.tagName.toLowerCase() : '';
                    if (['script', 'style', 'noscript', 'template'].includes(tag)) continue;

                    let text = el.textContent || '';
                    text += " " + (el.getAttribute('title') || '');
                    text += " " + (el.getAttribute('aria-label') || '');
                    text += " " + (el.getAttribute('alt') || '');
                    let cleanText = text.toLowerCase().replace(/\s+/g, '');
                    
                    if (cleanText.includes(cleanKeyword)) {
                        let rect = el.getBoundingClientRect();
                        let isVisible = (rect.width > 0 && rect.height > 0) || tag === 'area';
                        
                        if (isVisible) {
                            let rawText = text.trim();
                            if (rawText.length > 80) continue; 

                            let linkParent = el.closest('a');
                            if (linkParent && linkParent.href && linkParent.href.toLowerCase().includes('.pdf')) continue;
                            if (rawText.includes('表單') || rawText.includes('說明') || rawText.includes('規定')) continue;

                            let hasInteractiveParent = el.closest('a, button, [role="button"], tr, li, .ticket-unit, .display-table-row, area');
                            if (['p', 'h1', 'h2', 'h3', 'h4', 'span', 'strong', 'b', 'td', 'th', 'div'].includes(tag) && !hasInteractiveParent) continue; 

                            let isSoldOut = false;
                            let rowContainer = el.closest('tr, li, .ticket-unit, div.zone-area'); 
                            let classString = (el.className + ' ' + (rowContainer ? rowContainer.className : '')).toLowerCase();
                            
                            if (classString.includes('disabled') || classString.includes('soldout')) isSoldOut = true;
                            if (!isSoldOut && (cleanText.includes('已售完') || cleanText.includes('售罄') || cleanText.includes('缺貨') || cleanText.includes('尚餘:0') || cleanText.includes('尚餘：0'))) isSoldOut = true;

                            if (isSoldOut) {
                                console.log(`🚫 [鷹眼避雷] 該區已售完或尚餘0，繼續尋找...`, el);
                            } else {
                                possibleMatches.push(el);
                            }
                        }
                    }
                }

                // 🎯 拓元修復核心：優先級計分系統
                if (possibleMatches.length > 0) {
                    possibleMatches.sort((a, b) => {
                        let getScore = (el) => {
                            let t = el.tagName.toLowerCase();
                            if (['a', 'button', 'area'].includes(t)) return 3; // 實體按鈕最優先
                            if (['span', 'font', 'b', 'strong'].includes(t)) return 2; // 內部文字次之
                            if (['li', 'td'].includes(t)) return 1; // 列表再次之
                            return 0; // ul, div 等大外框最後
                        };
                        let scoreA = getScore(a);
                        let scoreB = getScore(b);
                        if (scoreA !== scoreB) return scoreB - scoreA; // 分數高的排前面
                        
                        let tA = ((a.textContent || '') + (a.getAttribute('title') || '')).trim();
                        let tB = ((b.textContent || '') + (b.getAttribute('title') || '')).trim();
                        return tA.length - tB.length;
                    });
                    foundElement = possibleMatches[0];
                    break;
                }
            }

            if (foundElement) {
                let rowContainer = foundElement.closest('.ticket-unit, .display-table-row');
                let rowQtyInput = null;
                if (rowContainer) rowQtyInput = rowContainer.querySelector('input:not([disabled]), select:not([disabled])');

                if (rowQtyInput && settings.dropdownValue !== "none") {
                    hasFilledQty = true; 
                    hasClickedZone = true;
                    setTimeout(() => { simulateHumanInput(rowQtyInput, settings.dropdownValue); }, getRandomDelay(200, 400));
                } else {
                    hasClickedZone = true; 
                    setTimeout(() => { stealthPhysicalClick(foundElement); }, getRandomDelay(150, 300)); 
                }
            }
        }
    }
}

function startAutoFill() {
    if (window.hasStartedAutoFill) return;
    window.hasStartedAutoFill = true;
    chrome.storage.sync.get(['autoCheck', 'dropdownValue', 'autoClickZone', 'zoneKeywords'], function(data) {
        if (!data) return; 
        console.log("🚀 [系統] 搶票引擎已強制啟動！目標關鍵字：", data.zoneKeywords);
        let attempts = 0;
        let intervalId = setInterval(() => {
            attempts++;
            executeFillForm(data);
            let allDone = true;
            if (data.autoCheck && !hasChecked) allDone = false;
            if (data.dropdownValue !== "none" && !hasFilledQty) allDone = false;
            if (data.autoClickZone && data.zoneKeywords && !hasClickedZone) allDone = false;
            if (allDone || attempts >= 150) clearInterval(intervalId);
        }, 150); 
    });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') startAutoFill();
else {
    try { document.addEventListener('DOMContentLoaded', startAutoFill); } catch(e){}
    try { window.addEventListener('load', startAutoFill); } catch(e){}
}
setTimeout(startAutoFill, 500);
