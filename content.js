// =========================================================================
// 🚀 搶票特工 V7.3 - 大師級火力版 (修復全域污染、onclick支援、精準售完判斷)
// =========================================================================

if (window.location.hostname.includes('ibon') || window.location.href.includes('UTK0201')) {
    try {
        let s = document.createElement('script');
        s.src = chrome.runtime.getURL('inject.js');
        s.onload = function() { this.remove(); };
        (document.head || document.documentElement).appendChild(s);
    } catch (e) { console.error("Inject failed:", e); }
}

// -------------------------------------------------------------------------
// 🛠️ 共通武器庫
// -------------------------------------------------------------------------
window.botLogs = [];

function extLog(msg) {
    let time = new Date().toLocaleTimeString('zh-TW', { hour12: false, fractionalSecondDigits: 3 });
    let fullMsg = `[${time}] ${msg}`;
    
    console.info(
        `%c🤖 搶票特工 %c ${fullMsg}`, 
        'background: #00ff00; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 12px;', 
        'color: #00ff00; font-weight: bold; font-size: 12px; background: #222; padding: 2px 6px; border-radius: 4px;'
    );

    window.botLogs.push(fullMsg);
    updateHUD(msg);
}

function updateHUD(msg) {
    try {
        let container = document.body || document.documentElement;
        if (!container) return; 
        
        let hud = document.getElementById('bot-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'bot-hud';
            hud.style.cssText = [
                'position:fixed', 'bottom:10px', 'left:10px', 'background:rgba(0,0,0,0.85)', 'color:#0f0',
                'padding:10px 14px', 'font-size:13px', 'z-index:2147483647', 'border-radius:6px', 'pointer-events:none',
                'font-family:monospace', 'font-weight:bold', 'border:1px solid #0f0', 'max-width:420px', 'word-break:break-all'
            ].join(';');
            container.appendChild(hud);
        } else if (!container.contains(hud)) {
            container.appendChild(hud); 
        }
        hud.innerText = msg;
    } catch (e) {}
}

function normalizeText(str) {
    if (!str) return "";
    return str.replace(/[\uff01-\uff5e]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
              .toLowerCase().replace(/[\s\u200B-\u200D\uFEFF,，＄$]/g, '');
}

function simulateHumanInput(targetElement, value) {
    try {
        let proto = targetElement.tagName.toLowerCase() === 'select' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
        let setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(targetElement, value);
        else targetElement.value = value;
        targetElement.dispatchEvent(new Event('focus',  { bubbles: true, composed: true }));
        targetElement.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } catch(e) {}
}

function isQuantitySelect(sel) {
    let opts = Array.from(sel.options).map(o => o.value);
    return opts.includes("1") || opts.includes("2");
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeIrregularInterval(callback, baseMs, jitterMs) {
    let stopped = false; let timerId;
    function next() {
        if (stopped) return;
        let delay = Math.max(50, baseMs + randInt(-jitterMs, jitterMs));
        timerId = setTimeout(async () => {
            try { await callback(); } catch(e) { console.error(e); }
            next();
        }, delay);
    }
    next();
    return { stop() { stopped = true; clearTimeout(timerId); } };
}

async function humanClick(el) {
    if (!el) return;
    try {
        let rect = el.getBoundingClientRect();
        let cx = rect.left + randFloat(rect.width * 0.25, rect.width * 0.75);
        let cy = rect.top + randFloat(rect.height * 0.25, rect.height * 0.75);
        const make = (type, extra = {}) => {
            let isPointer = type.startsWith('pointer');
            let EventClass = isPointer ? PointerEvent : MouseEvent;
            let opts = {
                view: window, bubbles: true, cancelable: true, composed: true, buttons: 1, button: 0,
                clientX: cx, clientY: cy, screenX: cx + (window.screenX || 0), screenY: cy + (window.screenY || 0), ...extra
            };
            if (isPointer) { opts.pointerId = 1; opts.pointerType = 'mouse'; opts.isPrimary = true; }
            return new EventClass(type, opts);
        };
        el.dispatchEvent(make('pointerover')); el.dispatchEvent(make('mouseover')); await sleep(randInt(20, 60));
        el.dispatchEvent(make('pointerdown')); el.dispatchEvent(make('mousedown')); await sleep(randInt(40, 100));
        el.dispatchEvent(make('pointerup')); el.dispatchEvent(make('mouseup')); await sleep(randInt(10, 30));
        el.dispatchEvent(make('click'));
        el.click(); 
    } catch(e) {}
}

window.isReloading = false;
async function triggerAutoReload(autoReloadOpt) {
    if (window.isReloading || !autoReloadOpt) return;
    window.isReloading = true;
    let waitTime = randInt(5000, 10000); 
    extLog(`🔄 [重整] 售完或無目標，準備自動重整...`);
    await sleep(waitTime);
    window.location.reload();
}

// -------------------------------------------------------------------------
// 🟢 拓元 (TixCraft) - 修復 P0 全域變數污染
// -------------------------------------------------------------------------
function runTixCraft(settings) {
    let autoCheck = settings.autoCheck !== false;
    let dropdownValue = settings.dropdownValue || "none";
    let autoClickZone = settings.autoClickZone === true;
    let zoneKeywords = settings.zoneKeywords || "";
    let autoReload = settings.autoReload === true; 

    let attempts = 0; 
    let isStopped = false;
    let isWaitingLogShown = false;
    let localIsClicking = false; // 🛡️ 取代 window.isClicking，保護迴圈
    let lastLinkCount = -1;
	
    async function loop() {
        if (isStopped || window.isReloading || attempts >= 400) return;
        
        let url = window.location.href;
        let isZonePage = url.includes('/ticket/area/');     
        let isTicketPage = url.includes('/ticket/ticket/'); 

        if (!isZonePage && !isTicketPage) {
            if (!isWaitingLogShown) {
                extLog(`🚀 [拓元] 潛伏中... 請手動進入「選區」或「選票」頁面`);
                isWaitingLogShown = true;
            }
            setTimeout(loop, 500); 
            return;
        }

        attempts++;
        try {
            if (!localIsClicking) {
                if (autoCheck) {
                    let cb = document.querySelector('#TicketForm_agree, #agree');
                    if (cb && !cb.checked) { cb.click(); extLog("✅ [拓元] 已勾選同意條款"); }
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

         if (autoClickZone && zoneKeywords && isZonePage) {
            let keywords = zoneKeywords.split(/,|，/).map(k => normalizeText(k.trim())).filter(k => k.length > 0);
            
            // ✅ 多層選擇器，由精確到模糊，任一命中即可
            const ZONE_SELECTORS = [
                // 原本的
                '.zone-area a',
                '.area-list a',
                // 拓元常見 class 變體
                '[class*="zone"] a',
                '[class*="area"] a',
                '[class*="ticket"] a',
                '[class*="seat"] a',
                // 通用 table/map 結構
                'table a[href*="ticket"]',
                'map area[href]',
                // 最後防線：所有含 ticket 路徑的 a
                'a[href*="/ticket/"]',
            ];
            // 取出所有命中的 link，去重複
            let linkSet = new Set();
            let links = [];
            for (let sel of ZONE_SELECTORS) {
                try {
                    document.querySelectorAll(sel).forEach(el => {
                        if (!linkSet.has(el)) {
                            linkSet.add(el);
                            links.push(el);
                        }
                    });
                } catch(e) {}
            }
            // ✅ 售完判斷也同樣多層
            function isSoldOut(el) {
                let text = normalizeText(el.innerText + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('alt') || ''));
                if (text.includes('售完') || text.includes('soldout') || text.includes('noseat')) return true;
                
                // 父層容器也檢查
                let parent = el.closest('li, td, div, span');
                if (parent) {
                    let parentText = normalizeText(parent.innerText);
                    if (parentText.includes('售完') || parentText.includes('soldout')) return true;
                    // 檢查父層是否有 disabled/soldout class
                    let parentClass = normalizeText(parent.className || '');
                    if (parentClass.includes('soldout') || parentClass.includes('disabled') || parentClass.includes('full')) return true;
                }
                // 自身 class 檢查
                let cls = normalizeText(el.className || '');
                if (cls.includes('soldout') || cls.includes('disabled') || cls.includes('full')) return true;
                return false;
            }
             if (links.length !== lastLinkCount) {
                 lastLinkCount = links.length;
                 extLog(`🔍 [拓元] 共掃到 ${links.length} 個連結`);
             }
            if (links.length > 0) {
                let foundValidTarget = false;
                for (let link of links) {
                    if (isSoldOut(link)) continue;
                    let text = normalizeText(link.innerText + ' ' + (link.getAttribute('title') || ''));
                    for (let kw of keywords) {
                        if (text.includes(kw)) {
                            foundValidTarget = true;
                            extLog(`🎯 [拓元] 鎖定區域: ${link.innerText.trim()}，仿生點擊！`);
                            localIsClicking = true;
                            await humanClick(link);
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
        } catch (err) {}
        
        setTimeout(loop, randInt(80, 150)); 
    }
    loop();
}

// -------------------------------------------------------------------------
// 🔵 KKTIX - 修復 P0 全域變數污染
// -------------------------------------------------------------------------
function runKKTIX(settings) {
    let autoCheck = settings.autoCheck !== false;
    let dropdownValue = settings.dropdownValue === "none" ? 1 : (parseInt(settings.dropdownValue) || 1);
    let autoClickZone = settings.autoClickZone === true;
    let zoneKeywords = settings.zoneKeywords || "";
    let autoReload = settings.autoReload === true;

    let attempts = 0;
    let isStopped = false;
    let isWaitingLogShown = false;
    let localIsClicking = false; // 🛡️ 取代 window.isClicking，保護迴圈

    async function loop() {
        if (isStopped || window.isReloading) return;

        if (!window.location.href.includes('registrations/new')) {
            if (!isWaitingLogShown) {
                extLog(`🚀 [KKTIX] 潛伏中... 等待進入選票頁面`);
                isWaitingLogShown = true;
            }
            setTimeout(loop, 500); 
            return;
        }

        attempts++;

        try {
            if (!localIsClicking) {
                if (autoCheck) {
                    let cb = document.getElementById('person_agree_terms');
                    if (cb && !cb.checked) {
                        cb.click();
                        extLog("✅ [KKTIX] 已勾選同意條款");
                    }
                }

                let plusBtns = Array.from(document.querySelectorAll('.ticket-list .plus, button.plus, .ng-scope .plus')).filter(b => !b.disabled && !b.classList.contains('disabled'));
                
                if (plusBtns.length > 0) {
                    let targetBtn = null; 
                    
                    if (autoClickZone && zoneKeywords) {
                        let keywords = zoneKeywords.split(/,|，/).map(k => normalizeText(k.trim())).filter(k => k.length > 0);
                        
                        for (let btn of plusBtns) {
                            let container = btn.closest('.ticket-unit, li, .row, div.ng-scope');
                            let text = container ? normalizeText(container.innerText) : "";
                            if (text.includes('售完') || text.includes('暫無票券')) continue;
                            if (keywords.length === 0 || keywords.some(kw => text.includes(kw))) {
                                targetBtn = btn;
                                break;
                            }
                        }
                    } else {
                        targetBtn = plusBtns[0]; 
                    }

                    if (targetBtn) {
                        localIsClicking = true; // 🛡️ 使用區域變數
                        extLog(`🎯 [KKTIX] 鎖定目標，執行連點 ${dropdownValue} 張...`);
                        
                        for (let i = 0; i < dropdownValue; i++) {
                            try { targetBtn.click(); } catch(e){}
                            if (i < dropdownValue - 1) await sleep(randInt(80, 150));
                        }
                        
                        extLog(`✅ [KKTIX] 已完成張數！請手動完成驗證碼！`);
                        localIsClicking = false; // 🛡️ 完成後釋放
                        isStopped = true; 
                        return;
                    } else {
                        if (attempts > 15 && autoReload) {
                            extLog(`⚠️ [KKTIX] 找不到目標區域或已售完，觸發重整...`);
                            triggerAutoReload(autoReload);
                        }
                    }
                } else {
                    if (attempts > 30 && autoReload) {
                        extLog(`⚠️ [KKTIX] 畫面無可選票種，觸發重整...`);
                        triggerAutoReload(autoReload);
                    }
                }
            }
        } catch (err) {
            console.error("[KKTIX Error]", err);
        }
        
        setTimeout(loop, randInt(80, 150)); 
    }
    loop();
}

// -------------------------------------------------------------------------
// 🟠 IBON - 完整修正版 (移除 Send 參數誤判，只用 UI 文字判斷售完)
// -------------------------------------------------------------------------
function patchIbonErrors() {
    try {
        let container = document.body || document.documentElement;
        if (!container) return;
        ['performanceId', 'productId', 'eventId'].forEach(id => {
            if (!document.getElementById(id)) {
                let div = document.createElement('div');
                div.id  = id; div.style.display = 'none';
                container.appendChild(div);
            }
        });
    } catch (e) {}
}
// 🛡️ 輔助函式：同時支援抓取 href 與 onclick 裡的 Send 指令
function getAreaAction(area) {
    return area.getAttribute('href') || area.getAttribute('onclick') || '';
}
function detectIBONStep() {
    // 同時掃描 href 與 onclick 屬性
    let areas = document.querySelectorAll('area[href*="Send"], area[onclick*="Send"]');
    if (areas.length > 0) return 'STEP_SELECT_ZONE';
    let qtySelects = Array.from(document.querySelectorAll('select:not([disabled])')).filter(isQuantitySelect);
    if (qtySelects.length > 0) return 'STEP_SELECT_QTY';
    if (document.querySelector('#btnPay, .btn-pay, [id*="pay" i]')) return 'STEP_CONFIRM';
    return 'STEP_WAITING';
}
function callSend(actionStr) {
    if (!actionStr || !actionStr.includes('Send')) return false;
    extLog(`🚀 [特工橋接] 傳送打擊指令給內部系統...`);
    window.postMessage({ type: 'EXECUTE_IBON', script: actionStr }, '*');
    return true;
}
function runIBON(settings) {
    patchIbonErrors();
    let autoClickZone = settings.autoClickZone === true;
    let zoneKeywords  = settings.zoneKeywords  || "";
    let dropdownValue = settings.dropdownValue || "none";
    let autoReload    = settings.autoReload    === true;
    extLog(`🚀 [IBON] 啟動 | 自動選區：${autoClickZone ? '開' : '關'} | 目標：${zoneKeywords || '無'} | 張數：${dropdownValue}`);
    let state = { lastStep: '', attempts: 0, clicked: false, qtyDone: false };
    let keywords = zoneKeywords.split(/,|，/).map(k => normalizeText(k.trim())).filter(Boolean);
    let scanner = makeIrregularInterval(async () => {
        if (window.isReloading) return;
        let step = detectIBONStep();
        if (step !== state.lastStep) {
            extLog(`📄 [IBON] 步驟切換：${state.lastStep || '初始'} → ${step}`);
            state.lastStep = step;
            if (step === 'STEP_SELECT_ZONE') { state.clicked = false; state.attempts = 0; }
        }
        // ─────────────────────────────────────────────
        // STEP_SELECT_ZONE：選區
        // ─────────────────────────────────────────────
if (step === 'STEP_SELECT_ZONE') {
    if (!autoClickZone) return;
    if (state.clicked) return;
    state.attempts++;
    let areas = Array.from(document.querySelectorAll('area[href*="Send"], area[onclick*="Send"]'));
    // ✅ 用 title 的「尚餘：0」判斷售完，完全不依賴 tr
    let availableAreas = areas.filter(area => {
        let title = area.getAttribute('title') || '';
        // 尚餘：0 → 售完，踢出
        let remainMatch = title.match(/尚餘[：:]\s*(\d+)/);
        if (remainMatch && parseInt(remainMatch[1]) === 0) {
            return false;
        }
        // 含「已售完」文字 → 踢出
        if (title.includes('已售完') || title.includes('售完')) {
            return false;
        }
        // 沒有 title 或 title 為空 → 踢出（無效 area）
        if (!title || title.trim() === '') {
            return false;
        }
        return true;
        // ⚠️ 不要用 cursor 判斷，IBON 全部 area 都是 cursor:default
    });
    
    extLog(`🔍 [IBON] 共 ${areas.length} 個區塊，未售完 ${availableAreas.length} 個`);
	availableAreas.slice(0, 5).forEach((area, i) => {
    let rawTitle   = area.getAttribute('title') || '';
    let normalized = normalizeText(rawTitle);
    extLog(`🔬 raw[${i}]: ${rawTitle.slice(0, 80)}`);
    extLog(`🔬 norm[${i}]: ${normalized.slice(0, 80)}`);
});
    // 無關鍵字：選第一個未售完
    if (keywords.length === 0) {
        if (availableAreas.length > 0) {
            let firstAvail = availableAreas[0];
            let title = firstAvail.getAttribute('title') || '';
            extLog(`🎯 [IBON] 無關鍵字，選第一個未售完：${title.slice(0, 50)}`);
            state.clicked = true;
            await sleep(randInt(100, 250));
            let actionStr = getAreaAction(firstAvail);
            if (!callSend(actionStr)) await humanClick(firstAvail);
        } else {
            extLog(`⚠️ [IBON] 所有區域皆已售完`);
            if (autoReload) triggerAutoReload(autoReload);
            scanner.stop();
        }
        return;
    }
    // 有關鍵字：從未售完清單中找符合的，按票價由高到低排序
    let matchedAreas = [];
    for (let area of availableAreas) {
        let areaId    = area.id || '';
        let areaTitle = normalizeText(area.getAttribute('title') || '');
        let areaText  = normalizeText([
            areaId,
            area.getAttribute('alt')       || '',
            area.getAttribute('data-name') || ''
        ].join(' '));
        let actionStr = getAreaAction(area);
        let codeM  = actionStr.match(/Send\s*\([^,]+,[^,]+,\s*['"]([^'"]+)['"]/);
        let code   = codeM ? normalizeText(codeM[1]) : '';
        let combined = areaText + areaTitle + code;
        if (keywords.some(kw => combined.includes(kw))) {
            let rawTitle   = area.getAttribute('title') || '';
            let priceMatch = rawTitle.match(/票價[：:]\s*(\d+)/);
            let price      = priceMatch ? parseInt(priceMatch[1]) : 0;
            matchedAreas.push({ area, price, rawTitle });
        }
    }
    // ✅ 按票價由高到低排序
    matchedAreas.sort((a, b) => b.price - a.price);
    matchedAreas.forEach((item, i) => {
        extLog(`🏷️ 符合第${i + 1}名 票價${item.price}：${item.rawTitle.slice(0, 50)}`);
    });
    let matched = matchedAreas.length > 0 ? matchedAreas[0].area : null;
    if (matched) {
        let actionStr = getAreaAction(matched);
        let title     = matched.getAttribute('title') || '';
        extLog(`🎯 [IBON] 命中目標！${title.slice(0, 60)}`);
        state.clicked = true;
        try {
            matched.scrollIntoView({ behavior: 'instant', block: 'center' });
            matched.style.outline         = '4px solid #00FF00';
            matched.style.backgroundColor = 'rgba(0,255,0,0.2)';
        } catch(e) {}
        await sleep(randInt(100, 250));
        if (!callSend(actionStr)) {
            extLog(`🖱️ [IBON] 橋接失敗，改使用仿生物理點擊`);
            await humanClick(matched);
        }
        return;
    }
    // 掃描上限
    if (state.attempts >= 2) {
        extLog(`⛔ [IBON] 已掃描 2 次未找到目標`);
        scanner.stop();
        if (autoReload) triggerAutoReload(autoReload);
    }
    return;
   }
        // ─────────────────────────────────────────────
        // STEP_SELECT_QTY：選張數
        // ─────────────────────────────────────────────
        if (step === 'STEP_SELECT_QTY') {
            if (state.qtyDone || dropdownValue === "none") return;
            let qtySelects = Array.from(document.querySelectorAll('select:not([disabled])')).filter(isQuantitySelect);
            if (qtySelects.length === 0) return;
            let sel       = qtySelects[0];
            let target    = dropdownValue.toString();
            let validOpts = Array.from(sel.options).filter(o => parseInt(o.value) > 0);
            if (!Array.from(sel.options).some(o => o.value === target) && validOpts.length > 0) {
                target = validOpts[validOpts.length - 1].value;
            }
            if (sel.value !== target) {
                simulateHumanInput(sel, target);
                extLog(`✅ [IBON] 已選 ${target} 張！請手動輸入驗證碼！`);
                state.qtyDone = true;
            }
            return;
        }
        // ─────────────────────────────────────────────
        // STEP_CONFIRM：確認頁，停止掃描
        // ─────────────────────────────────────────────
        if (step === 'STEP_CONFIRM') {
            extLog(`🎉 [IBON] 已到達確認頁，停止掃描`);
            scanner.stop();
            return;
        }
    }, 200, 80);
}

// =========================================================================
// 🚀 核心路由
// =========================================================================
function detectPlatform() {
    let host = window.location.hostname;
    let url  = window.location.href;
    if (host.includes('ibon') || host.includes('utk') || url.includes('UTK0201')) return 'IBON';
    if (host.includes('tixcraft')) return 'TIXCRAFT';
    if (host.includes('kktix'))    return 'KKTIX';
    return 'UNKNOWN';
}

function startAutoFill() {
    if (window.hasStartedAutoFill) return;
    let platform = detectPlatform();
    if (platform === 'UNKNOWN') return; 

    window.hasStartedAutoFill = true;
    chrome.storage.sync.get(
        ['autoCheck', 'autoReload', 'dropdownValue', 'autoClickZone', 'zoneKeywords'],
        function(data) {
            let settings = data || {};
            if      (platform === 'TIXCRAFT') runTixCraft(settings);
            else if (platform === 'KKTIX')    runKKTIX(settings);
            else if (platform === 'IBON')     runIBON(settings);
        }
    );
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startAutoFill();
} else {
    document.addEventListener('DOMContentLoaded', startAutoFill);
    window.addEventListener('load', startAutoFill);
}
setTimeout(startAutoFill, 300);
