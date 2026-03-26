// =========================================================================
// 🚀 搶票外掛 V6.6 破甲精準版 - 拓元/KKTIX/IBON (修正 KKTIX 張數與關鍵字)
// =========================================================================

// -------------------------------------------------------------------------
// 🛠️ 共通武器庫 (Shared Utilities & Human-like Simulation)
// -------------------------------------------------------------------------
window.botLogs = [];
function extLog(msg) {
    let time = new Date().toLocaleTimeString('zh-TW', { hour12: false, fractionalSecondDigits: 3 });
    let fullMsg = `[${time}] ${msg}`;
    console.log(fullMsg);
    window.botLogs.push(fullMsg);
    updateHUD(msg); 
}

function normalizeText(str) {
    if (!str) return "";
    let halfWidthStr = str.replace(/[\uff01-\uff5e]/g, function(ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    });
    return halfWidthStr.toLowerCase().replace(/[\s\u200B-\u200D\uFEFF,，＄$]/g, '');
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 🔄 自動重整倒數引擎 (5~10秒隨機)
window.isReloading = false;
async function triggerAutoReload(autoReloadOpt) {
    if (window.isReloading || !autoReloadOpt) return;
    window.isReloading = true;
    
    let waitTime = getRandomInt(5000, 10000); 
    let seconds = Math.floor(waitTime / 1000);

    for (let i = seconds; i > 0; i--) {
        extLog(`🔄 [完售/無目標] 找不到可用區域，將於 ${i} 秒後自動重整...`);
        await sleep(1000);
    }
    extLog(`🔄 執行重整！`);
    window.location.reload();
}

// 🤖 仿生人類點擊
async function simulateHumanClick(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.top + rect.height / 2;

    if (rect.width > 10 && rect.height > 10) {
        x = rect.left + getRandomInt(5, Math.floor(rect.width) - 5);
        y = rect.top + getRandomInt(5, Math.floor(rect.height) - 5);
    }

    const eventInit = {
        view: window, bubbles: true, cancelable: true, composed: true, buttons: 1,
        clientX: x, clientY: y,
        screenX: x + window.screenX, screenY: y + window.screenY
    };

    try { el.dispatchEvent(new MouseEvent('pointerover', eventInit)); } catch(e){}
    try { el.dispatchEvent(new MouseEvent('pointerdown', eventInit)); } catch(e){}
    try { el.dispatchEvent(new MouseEvent('mousedown', eventInit)); } catch(e){}
    // ⬇️ 這裡！滑鼠按下去之後，隨機停頓 10 ~ 30 毫秒才放開
    // 這個數值目前是最完美的，通常不需要改。如果改成 0 會太像外掛。    
    await sleep(getRandomInt(10, 30)); 
    
    try { el.dispatchEvent(new MouseEvent('pointerup', eventInit)); } catch(e){}
    try { el.dispatchEvent(new MouseEvent('mouseup', eventInit)); } catch(e){}
    try { el.dispatchEvent(new MouseEvent('click', eventInit)); } catch(e){}
    
    try { el.click(); } catch(e){} 
}

function simulateHumanInput(targetElement, value) {
    let prototype = targetElement.tagName.toLowerCase() === 'select' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    let nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if(nativeInputValueSetter) nativeInputValueSetter.call(targetElement, value);
    else targetElement.value = value;
    
    targetElement.dispatchEvent(new Event('focus', { bubbles: true, composed: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

function isQuantitySelect(sel) {
    let opts = Array.from(sel.options).map(o => o.value);
    return opts.includes("1") || opts.includes("2");
}

function updateHUD(msg) {
    let hud = document.getElementById('bot-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'bot-hud';
        hud.style.cssText = 'position:fixed; bottom:10px; left:10px; background:rgba(0,0,0,0.8); color:#0f0; padding:10px; font-size:14px; z-index:999999; border-radius:5px; pointer-events:none; font-family:monospace; font-weight:bold; border:1px solid #0f0;';
        document.body.appendChild(hud);
    }
    hud.innerText = msg;
}

// -------------------------------------------------------------------------
// 🟢 專武 1：拓元 (TixCraft)
// -------------------------------------------------------------------------
function runTixCraft(settings) {
    let autoCheck = settings.autoCheck !== false;
    let dropdownValue = settings.dropdownValue || "none";
    let autoClickZone = settings.autoClickZone === true;
    let zoneKeywords = settings.zoneKeywords || "";
    let autoReload = settings.autoReload === true; 

    extLog(`🚀 [啟動] 拓元狙擊模式 | 準備就緒`);

    let attempts = 0;
    let isStopped = false;

    async function loop() {
        if (isStopped || window.isReloading || attempts >= 400) return;
        attempts++;

        if (!window.isClicking) {
            if (autoCheck) {
                let cb = document.getElementById('TicketForm_agree');
                if (cb && !cb.checked) {
                    cb.click();
                    extLog("✅ [拓元] 已勾選同意條款");
                }
            }

            let qtySelects = Array.from(document.querySelectorAll('select')).filter(isQuantitySelect);
            if (qtySelects.length > 0 && dropdownValue !== "none") {
                for (let sel of qtySelects) {
                    let desiredValue = dropdownValue.toString();
                    let validOpts = Array.from(sel.options).filter(opt => parseInt(opt.value) > 0);
                    if (!Array.from(sel.options).some(opt => opt.value === desiredValue) && validOpts.length > 0) {
                        desiredValue = validOpts[validOpts.length - 1].value;
                    }
                    if (sel.value !== desiredValue) {
                        simulateHumanInput(sel, desiredValue);
                        extLog(`✅ [拓元] 已自動選擇 ${desiredValue} 張`);
                    }
                }
            }

            if (autoClickZone && zoneKeywords) {
                let keywords = zoneKeywords.split(/,|，/).map(k => normalizeText(k.trim())).filter(k => k.length > 0);
                let links = document.querySelectorAll('.zone-area a, .area-list a');
                
                if (links.length > 0) {
                    let foundValidTarget = false;
                    for (let link of links) {
                        let text = normalizeText(link.innerText);
                        if (text.includes('售完') || text.includes('缺票')) continue;

                        for (let kw of keywords) {
                            if (text.includes(kw)) {
                                foundValidTarget = true;
                                extLog(`🎯 [拓元] 鎖定區域: ${link.innerText}，仿生點擊！`);
                                window.isClicking = true;
                                await simulateHumanClick(link);
                                isStopped = true;
                                return;
                            }
                        }
                    }
                    if (!foundValidTarget) triggerAutoReload(autoReload);
                } else if (attempts > 30) {
                    triggerAutoReload(autoReload);
                }
            }
        }
        setTimeout(loop, getRandomInt(80, 150)); 
    }
    loop();
}

// -------------------------------------------------------------------------
// 🔵 專武 2：KKTIX (修復關鍵字與張數連點)
// -------------------------------------------------------------------------
function runKKTIX(settings) {
    let autoCheck = settings.autoCheck !== false;
    // 💡 防呆機制：如果 KKTIX 下拉選單選了 none，我們還是預設給 1 張，否則加號不會動
    let dropdownValue = settings.dropdownValue === "none" ? 1 : (parseInt(settings.dropdownValue) || 1);
    let autoClickZone = settings.autoClickZone === true;
    let zoneKeywords = settings.zoneKeywords || "";
    let autoReload = settings.autoReload === true;

    extLog(`🚀 [啟動] KKTIX 狙擊模式 | 修正關鍵字與數量鎖定`);

    let attempts = 0;
    let isStopped = false;
    let kktixQtyDone = false; 

    async function loop() {
        if (isStopped || window.isReloading || attempts >= 400) return;
        attempts++;

        if (!window.isClicking) {
            if (autoCheck) {
                let cb = document.getElementById('person_agree_terms');
                if (cb && !cb.checked) {
                    cb.click();
                    extLog("✅ [KKTIX] 已勾選同意條款");
                }
            }

            // 💡 1. 直接抓畫面上所有「沒被禁用」的加號按鈕
            let plusBtns = Array.from(document.querySelectorAll('.ticket-list .plus')).filter(b => !b.disabled && !b.classList.contains('disabled'));
            
            if (plusBtns.length > 0) {
                let targetBtn = null; 
                
                // 💡 2. 關鍵字比對 (反向尋找父元素)
                if (autoClickZone && zoneKeywords) {
                    let keywords = zoneKeywords.split(/,|，/).map(k => normalizeText(k.trim())).filter(k => k.length > 0);
                    
                    for (let btn of plusBtns) {
                        // 往外找包住它的容器 (可能是 li 或是 div)，讀出票種名稱
                        let container = btn.closest('li, .ticket-unit, .row, div');
                        let text = container ? normalizeText(container.innerText) : "";
                        
                        if (text.includes('售完') || text.includes('暫無票券')) continue;

                        // 無差別突擊 (沒給關鍵字) 或 包含關鍵字
                        if (keywords.length === 0 || keywords.some(kw => text.includes(kw))) {
                            targetBtn = btn;
                            break;
                        }
                    }
                } else {
                    targetBtn = plusBtns[0]; // 如果什麼都沒設定，直接鎖定第一個
                }

                // 💡 3. 執行張數連點
                if (targetBtn && !kktixQtyDone) {
                    window.isClicking = true;
                    extLog(`🎯 [KKTIX] 鎖定目標，準備連點 ${dropdownValue} 張`);
                    
                    for (let i = 0; i < dropdownValue; i++) {
                        try { targetBtn.click(); } catch(e){}
                        // 關鍵防護：必須給 Angular 框架至少 80ms~150ms 消化點擊，不然會被吃掉
                        if (i < dropdownValue - 1) await sleep(getRandomInt(80, 150));
                    }
                    kktixQtyDone = true; 
                    extLog(`✅ [KKTIX] 已完成張數選擇！`);
                    window.isClicking = false;
                } else if (!targetBtn && !kktixQtyDone) {
                    // 如果還是找不到，代表真的全賣完了
                    triggerAutoReload(autoReload);
                }
            } else if (attempts > 30 && document.querySelector('.ticket-list')) {
                // 有選單但沒加號
                triggerAutoReload(autoReload);
            }
        }
        setTimeout(loop, getRandomInt(80, 150)); 
    }
    loop();
}

// -------------------------------------------------------------------------
// 🟠 專武 3：IBON (完美劫持降維打擊版 + 仿生點擊)
// -------------------------------------------------------------------------
function patchIbonErrors() {
    ['performanceId', 'productId', 'eventId'].forEach(id => {
        if (!document.getElementById(id)) {
            let div = document.createElement('div');
            div.id = id; div.style.display = 'none';
            document.body.appendChild(div);
        }
    });
}

function findStrictShadowTR(keywords, root = document) {
    let trs = Array.from(root.querySelectorAll('tr'));
    for (let tr of trs) {
        let text = normalizeText(tr.innerText || tr.textContent || "");
        if (text.length < 2 || text.includes('售完') || text.includes('售罄') || tr.classList.contains('disabled')) continue;
        
        if (!keywords || keywords.length === 0 || (keywords.length === 1 && keywords[0] === "")) return tr; 

        for (let kw of keywords) {
            if (text.includes(kw)) return tr; 
        }
    }
    let allNodes = Array.from(root.querySelectorAll('*'));
    for (let node of allNodes) {
        if (node.shadowRoot) { 
            let found = findStrictShadowTR(keywords, node.shadowRoot);
            if (found) return found;
        }
    }
    return null;
}

function findMapArea(areaId, root = document) {
    let area = root.querySelector(`area[id="${areaId}"], area[data-id="${areaId}"]`);
    if (area) return area;
    let allNodes = Array.from(root.querySelectorAll('*'));
    for (let node of allNodes) {
        if (node.shadowRoot) {
            let found = findMapArea(areaId, node.shadowRoot);
            if (found) return found;
        }
    }
    return null;
}

async function executeUltimateStrike(targetElement) {
    try {
        targetElement.scrollIntoView({ behavior: 'instant', block: 'center' });
        targetElement.style.outline = "4px solid #00FF00";
        targetElement.style.backgroundColor = "rgba(0, 255, 0, 0.4)";
    } catch(e){}

    let rel = targetElement.getAttribute('rel');
    let areaId = rel ? rel.split(' ')[0] : null;
    let form = document.getElementById('aspnetForm') || document.forms[0] || document.querySelector('form');

    if (areaId) {
        let mapArea = findMapArea(areaId);
        if (mapArea && form) {
            let href = mapArea.getAttribute('href') || '';
            let postBackMatch = href.match(/__doPostBack\s*\(\s*['"](.*?)['"]\s*,\s*['"](.*?)['"]\s*\)/);
            if (postBackMatch) {
                extLog(`⚡ [深層劫持] 解析 ASP.NET，強制表單提交！`);
                let tInput = document.getElementById('__EVENTTARGET') || document.createElement('input');
                tInput.type = 'hidden'; tInput.name = '__EVENTTARGET'; tInput.id = '__EVENTTARGET'; tInput.value = postBackMatch[1];
                form.appendChild(tInput);
                let aInput = document.getElementById('__EVENTARGUMENT') || document.createElement('input');
                aInput.type = 'hidden'; aInput.name = '__EVENTARGUMENT'; aInput.id = '__EVENTARGUMENT'; aInput.value = postBackMatch[2];
                form.appendChild(aInput);
                form.submit();
                return;
            }
        }
    }

    extLog(`⚡ [實體打擊] 執行隨機座標+延遲之仿生點擊！`);
    patchIbonErrors(); 
    let innerTarget = targetElement.querySelector('td, a, span, label') || targetElement;
    await simulateHumanClick(innerTarget);
}

function runIBON(settings) {
    let autoClickZone = settings.autoClickZone === true;
    let zoneKeywords = settings.zoneKeywords || "";
    let dropdownValue = settings.dropdownValue || "none";
    let autoReload = settings.autoReload === true;

    extLog(`🚀 [啟動] IBON狙擊模式 | 準備就緒`);

    window.isClicking = false; 
    let attempts = 0;
    let isStopped = false;

    async function loop() {
        if (isStopped || window.isReloading || attempts >= 400) return;
        attempts++;

        if (!window.isClicking) {
            let url = window.location.href.toLowerCase();
            let keywords = zoneKeywords.split(/,|，/).map(k => normalizeText(k.trim())).filter(k => k.length > 0);
            
            let qtySelects = Array.from(document.querySelectorAll('select:not([disabled])')).filter(isQuantitySelect);
            if (qtySelects.length > 0) {
                if (dropdownValue !== "none") {
                    for (let sel of qtySelects) {
                        let desiredValue = dropdownValue.toString();
                        let validOpts = Array.from(sel.options).filter(opt => parseInt(opt.value) > 0);
                        if (!Array.from(sel.options).some(opt => opt.value === desiredValue) && validOpts.length > 0) {
                            desiredValue = validOpts[validOpts.length - 1].value;
                        }
                        if (sel.value !== desiredValue) {
                            simulateHumanInput(sel, desiredValue); 
                            extLog(`✅ [IBON] 已選好 ${desiredValue} 張！請輸入驗證碼！`);
                        }
                    }
                }
                return; 
            }

            let acted = false; 
            // 尋找目標日期或區域
            if (autoClickZone) {
                let targetEl = findStrictShadowTR(keywords); 
                if (targetEl) {
                    window.isClicking = true; 
                    acted = true;
                    await executeUltimateStrike(targetEl); 
			    // ⬇️ 這裡！點擊後強制外掛冷卻 2500 毫秒 (2.5秒)，不准再點第二下
			    // 如果你覺得 2.5 秒太久，網頁早就載入完了，可以改成 1000 (1秒) 或 1500 (1.5秒)					
                    setTimeout(() => { window.isClicking = false; }, 700); 
                }
            }

        //    if (!acted && autoClickZone && (url.includes('utk0201_000') || url.includes('activityinfo'))) {
        //        let nextBtns = Array.from(document.querySelectorAll('a, button, .btn')).filter(el => {
        //            if (el.classList.contains('disabled') || el.disabled) return false;
        //            let txt = el.innerText || ""; let href = el.href || "";
        //            return txt.includes('訂購') || txt.includes('購票') || txt.includes('立即購票') || txt.includes('選擇') || href.includes('utk0201_001');
        //        });
        //        if (nextBtns.length > 0) {
        //            window.isClicking = true;
        //            acted = true;
        //            extLog(`🎫 [保送] 發現場次按鈕，仿生點擊進入！`);
        //            await simulateHumanClick(nextBtns[0]);
        //            setTimeout(() => { window.isClicking = false; }, 2500); 
        //        }
        //    }

            if (!acted && autoReload && attempts > 25) {
                if (url.includes('utk0201_000') || url.includes('utk0201_001') || url.includes('utk0201_002') || url.includes('activityinfo')) {
                    triggerAutoReload(autoReload);
                }
            }
        }
        setTimeout(loop, getRandomInt(80, 170));
    }
    loop();
}

// -------------------------------------------------------------------------
// 🚀 核心路由 (Router)
// -------------------------------------------------------------------------
function detectPlatform() {
    let host = window.location.hostname;
    if (host.includes('ibon')) return 'IBON';
    if (host.includes('tixcraft')) return 'TIXCRAFT';
    if (host.includes('kktix')) return 'KKTIX';
    return 'UNKNOWN';
}

function startAutoFill() {
    if (window.hasStartedAutoFill) return;
    let platform = detectPlatform();
    if (platform !== 'IBON' && window.top !== window) return; 

    window.hasStartedAutoFill = true;
    chrome.storage.sync.get(['autoCheck', 'autoReload', 'dropdownValue', 'autoClickZone', 'zoneKeywords'], function(data) {
        let settings = data || {}; 
        if (platform === 'TIXCRAFT') runTixCraft(settings);
        else if (platform === 'KKTIX') runKKTIX(settings);
        else if (platform === 'IBON') runIBON(settings);
    });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') startAutoFill();
else {
    try { document.addEventListener('DOMContentLoaded', startAutoFill); } catch(e){}
    try { window.addEventListener('load', startAutoFill); } catch(e){}
}
setTimeout(startAutoFill, 150);
