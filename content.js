// =========================================================================
// 🚀 搶票外掛 V5.5 - 財神爺自動對帳版 (KKTIX 票價逗號無視)
// =========================================================================

let hasChecked = false;
let hasFilledQty = false;
let hasClickedZone = false; 
window.isReloading = false; 

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
    let targetToClick = element.closest('a, button, [role="button"], area');
    if (!targetToClick) {
        targetToClick = element.querySelector('a, button, [role="button"], area') || element;
    }

    try { 
        targetToClick.style.outline = "4px solid red"; 
        targetToClick.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
    } catch(e){}

    console.log(`💥 [精準狙擊] 鎖定目標準備開火!`, targetToClick);

    let hrefAttr = targetToClick.getAttribute('href') || targetToClick.href || "";
    if (hrefAttr.toLowerCase().includes('javascript:')) {
        console.log("⚡ [系統] 觸發 CSP 防護，呼叫特工執行暗號...");
        window.postMessage({ type: 'EXECUTE_IBON', script: hrefAttr }, '*');
        return; 
    }

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
    targetElement.dispatchEvent(new Event('input', { bubbles: true })); 
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
    targetElement.dispatchEvent(new Event('blur', { bubbles: true }));
}

function executeFillForm(settings, attempts) {
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
        // 🎯 使用者輸入的關鍵字 (例如: 5880)
        const targetKeywords = settings.zoneKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

        if (targetKeywords.length > 0) {
            let allElements = getAllElementsIncludingShadow();
            let foundElement = null;
            let anySoldOutForTarget = false; 

            for (let keyword of targetKeywords) {
                if (foundElement) break; 
                // 將使用者關鍵字的空白、逗號、錢號都去掉 (保險起見)
                let cleanKeyword = keyword.toLowerCase().replace(/[\s,\$]/g, '');
                let possibleMatches = []; 

                for (let el of allElements) {
                    let tag = el.tagName ? el.tagName.toLowerCase() : '';
                    if (['script', 'style', 'noscript', 'template'].includes(tag)) continue;

                    let text = el.textContent || '';
                    text += " " + (el.getAttribute('title') || '');
                    text += " " + (el.getAttribute('aria-label') || '');
                    text += " " + (el.getAttribute('alt') || '');
                    
                    // 💰 核心魔法：把網頁上的字去空白、去逗號、去金錢符號！讓 "TWD$5,880" 變成 "twd5880"
                    let cleanText = text.toLowerCase().replace(/[\s,\$]/g, '');
                    
                    if (cleanText.includes(cleanKeyword)) {
                        
                        // 🚫 KKTIX 輪椅/身心障礙陷阱過濾器
                        if (!cleanKeyword.includes('輪椅') && !cleanKeyword.includes('身心') && !cleanKeyword.includes('障礙')) {
                            if (cleanText.includes('輪椅') || cleanText.includes('身心障礙') || cleanText.includes('殘障')) {
                                continue; 
                            }
                        }

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
                            let rowContainer = el.closest('tr, li, .ticket-unit, div.zone-area, .display-table-row'); 
                            let classString = (el.className + ' ' + (rowContainer ? rowContainer.className : '')).toLowerCase();
                            
                            // 同樣把整列的文字也過濾掉逗號，確保判斷精準
                            let containerText = rowContainer ? rowContainer.textContent.toLowerCase().replace(/[\s,\$]/g, '') : cleanText;

                            if (classString.includes('disabled') || classString.includes('soldout')) isSoldOut = true;
                            if (!isSoldOut && (containerText.includes('已售完') || containerText.includes('售罄') || containerText.includes('缺貨') || containerText.includes('尚餘:0') || containerText.includes('尚餘：0'))) {
                                isSoldOut = true;
                            }

                            if (isSoldOut) {
                                if (!el.dataset.logged) {
                                    console.log(`🚫 [鷹眼避雷] 目標 [${keyword}] 已售完，繼續尋找...`);
                                    el.dataset.logged = "true";
                                }
                                anySoldOutForTarget = true;
                            } else {
                                possibleMatches.push(el);
                            }
                        }
                    }
                }

                if (possibleMatches.length > 0) {
                    possibleMatches.sort((a, b) => {
                        let getScore = (el) => {
                            let t = el.tagName.toLowerCase();
                            if (['a', 'button', 'area'].includes(t)) return 3; 
                            if (['span', 'font', 'b', 'strong'].includes(t)) return 2; 
                            if (['li', 'td'].includes(t)) return 1; 
                            return 0; 
                        };
                        let scoreA = getScore(a);
                        let scoreB = getScore(b);
                        if (scoreA !== scoreB) return scoreB - scoreA; 
                        
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
            else if (settings.autoReload && anySoldOutForTarget && !window.isReloading && attempts > 4) {
                window.isReloading = true;
                let reloadDelay = getRandomDelay(1200, 2500); 
                console.log(`🔄 [自動撿漏啟動] 你的目標區域目前均已售完！外掛將在 ${reloadDelay} 毫秒後自動 F5 重新整理刷票...`);
                setTimeout(() => {
                    window.location.reload();
                }, reloadDelay);
            }
        }
    }
}

function startAutoFill() {
    if (window.hasStartedAutoFill) return;
    window.hasStartedAutoFill = true;
    chrome.storage.sync.get(['autoCheck', 'autoReload', 'dropdownValue', 'autoClickZone', 'zoneKeywords'], function(data) {
        if (!data) return; 
        console.log("🚀 [系統] 搶票引擎已啟動！目標關鍵字：", data.zoneKeywords);
        let attempts = 0;
        let intervalId = setInterval(() => {
            if (window.isReloading) return; 
            attempts++;
            executeFillForm(data, attempts);
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
