// =========================================================================
// 🚀 搶票特工 V7.2 - IBON 終極選區版 (嚴格過濾售完 & 尊重自動打勾)
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
// 🟢 拓元 (TixCraft)
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
            if (!window.isClicking) {
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
// 🔵 KKTIX
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
            if (!window.isClicking) {
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
                        window.isClicking = true;
                        extLog(`🎯 [KKTIX] 鎖定目標，執行連點 ${dropdownValue} 張...`);
                        
                        for (let i = 0; i < dropdownValue; i++) {
                            try { targetBtn.click(); } catch(e){}
                            if (i < dropdownValue - 1) await sleep(randInt(80, 150));
                        }
                        
                        extLog(`✅ [KKTIX] 已完成張數！請手動完成驗證碼！`);
                        window.isClicking = false;
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
// 🟠 IBON - 修復售完邏輯與尊重打勾
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

function detectIBONStep() {
    let areas = document.querySelectorAll('area[href*="Send"]');
    if (areas.length > 0) return 'STEP_SELECT_ZONE';
    let qtySelects = Array.from(document.querySelectorAll('select:not([disabled])')).filter(isQuantitySelect);
    if (qtySelects.length > 0) return 'STEP_SELECT_QTY';
    if (document.querySelector('#btnPay, .btn-pay, [id*="pay" i]')) return 'STEP_CONFIRM';
    return 'STEP_WAITING';
}

function callSend(href) {
    if (!href || !href.includes('Send')) return false;
    extLog(`🚀 [特工橋接] 傳送打擊指令給內部系統...`);
    window.postMessage({ type: 'EXECUTE_IBON', script: href }, '*');
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

        if (step === 'STEP_SELECT_ZONE') {
            // 🛡️ 防護：如果使用者「取消打勾」自動選區，這裡直接返回，完全不介入點擊動作！
            if (!autoClickZone) return;

            if (state.clicked) return;
            state.attempts++;

            // 抓取畫面上所有的區域 (area)
            let areas = Array.from(document.querySelectorAll('area[href*="Send"]'));

            // 🌟 嚴格過濾：把「已售完」的區域全部剔除！
            let availableAreas = areas.filter(area => {
                let href = area.getAttribute('href') || '';
                
                // 檢查 1：IBON 舊版 href 參數如果第 4 個是 '0'，代表售完
                let soldM = href.match(/Send\s*\([^,]+,[^,]+,[^,]+,\s*['"](\d+)['"]/);
                if (soldM && soldM[1] === '0') return false; 
                
                // 檢查 2：抓取對應的表格列 (tr)，檢查裡面有沒有寫「售完」
                let areaId = area.id || '';
                if (areaId) {
                    let trEl = document.querySelector(`tr[rel~="${areaId}"]`);
                    if (trEl) {
                        let trText = trEl.textContent || '';
                        if (trText.includes('售完') || trText.includes('已售完')) {
                            return false; // 確實售完，排除！
                        }
                    }
                }
                return true; // 通過檢查，是可購買的區域
            });

            // 如果沒填關鍵字，就選「可購買清單」裡面的第一個
            if (keywords.length === 0) {
                if (availableAreas.length > 0) {
                    let firstAvail = availableAreas[0];
                    extLog(`🎯 [IBON] 無關鍵字，選第一個「未售完」的區域`);
                    state.clicked = true;
                    await sleep(randInt(100, 250));
                    let href = firstAvail.getAttribute('href');
                    if (!callSend(href)) await humanClick(firstAvail); 
                    return;
                }
            } 
            // 如果有填關鍵字，從「可購買清單」裡面尋找符合的
            else {
                let matched = null;
                for (let area of availableAreas) {
                    let areaId = area.id || '';
                    let areaText = normalizeText([areaId, area.getAttribute('alt') || '', area.getAttribute('title') || '', area.getAttribute('data-name') || ''].join(' '));
                    let trEl = document.querySelector(`tr[rel~="${areaId}"]`);
                    let trText = trEl ? normalizeText(trEl.textContent || '') : '';
                    
                    let href = area.getAttribute('href') || '';
                    let codeM = href.match(/Send\s*\([^,]+,[^,]+,\s*['"]([^'"]+)['"]/);
                    let code = codeM ? normalizeText(codeM[1]) : '';
                    
                    let combined = areaText + trText + code;

                    if (keywords.some(kw => combined.includes(kw))) { 
                        matched = area; 
                        break; 
                    }
                }

                if (matched) {
                    let href = matched.getAttribute('href');
                    let areaId = matched.id || href.slice(0, 60);
                    extLog(`🎯 [IBON] 命中目標！${areaId}`);
                    state.clicked = true;
                    try {
                        let trEl = document.querySelector(`tr[rel~="${matched.id}"]`);
                        if (trEl) {
                            trEl.scrollIntoView({ behavior: 'instant', block: 'center' });
                            trEl.style.outline = '4px solid #00FF00';
                            trEl.style.backgroundColor = 'rgba(0,255,0,0.2)';
                        }
                    } catch(e) {}

                    await sleep(randInt(100, 250));
                    if (!callSend(href)) { extLog(`🖱️ [IBON] 橋接失敗，改使用仿生物理點擊`); await humanClick(matched); }
                    return;
                }
            }

            if (state.attempts >= 30) {
                extLog(`⛔ [IBON] 已掃描 30 次未找到目標 (或皆已售完)`);
                scanner.stop();
                if (autoReload) triggerAutoReload(autoReload); 
            }
            return;
        }

        if (step === 'STEP_SELECT_QTY') {
            if (state.qtyDone || dropdownValue === "none") return;
            let qtySelects = Array.from(document.querySelectorAll('select:not([disabled])')).filter(isQuantitySelect);
            if (qtySelects.length === 0) return;

            let sel = qtySelects[0];
            let target = dropdownValue.toString();
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
