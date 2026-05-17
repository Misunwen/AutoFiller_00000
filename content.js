// =========================================================================
// 🔺 第一行就執行：inject.min.js 注入（必須在任何邏輯之前）
// =========================================================================
function injectScript() {
    try {
        let s = document.createElement('script');
        s.src = chrome.runtime.getURL('inject.min.js');
        s.onload = function() { this.remove(); };
        (document.head || document.documentElement).appendChild(s);
        console.info('✅ inject.min.js 注入成功');
        // ⚠️ 注意：這裡不能用 extLog()，因為 extLog 還沒定義
    } catch(e) {
        console.error('inject 失敗:', e);
    }
}
if (
    window.location.hostname.includes('ibon') ||
    window.location.href.includes('UTK0201')
) {
    if (document.documentElement) {
        injectScript();
    } else {
        document.addEventListener('DOMContentLoaded', injectScript);
    }
}
// ✅ 全局掃描器管理
let globalIBONScanner = null;

function startAutoFill() {
    let platform = detectPlatform();
    if (platform === 'UNKNOWN') return;
    
    let flagKey = `hasStartedAutoFill_${platform}`;
    if (window[flagKey]) return;
    window[flagKey] = true;
    
    chrome.storage.sync.get(
        ['autoCheck', 'autoReload', 'dropdownValue', 'autoClickZone', 'zoneKeywords'],
        function(data) {
            let raw = data || {};
            let settings = {
                autoCheck:     raw.autoCheck     === true,
                autoReload:    raw.autoReload    === true,
                autoClickZone: raw.autoClickZone === true,
                dropdownValue: raw.dropdownValue || "none",
                zoneKeywords:  raw.zoneKeywords  || ""
            };
            
            // ✅ 停止舊的掃描器
            if (globalIBONScanner) {
                globalIBONScanner.stop();
                globalIBONScanner = null;
            }
            
            extLog(`🚀 [路由] 平台：${platform}`);
            extLog(`🚀 [路由] 讀取設定：`);
            extLog(`  - autoCheck: ${settings.autoCheck}`);
            extLog(`  - autoReload: ${settings.autoReload}`);
            extLog(`  - autoClickZone: ${settings.autoClickZone}`);
            extLog(`  - dropdownValue: ${settings.dropdownValue}`);
            extLog(`  - zoneKeywords: ${settings.zoneKeywords}`);
            
            if      (platform === 'TIXCRAFT') runTixCraft(settings);
            else if (platform === 'KKTIX')    runKKTIX(settings);
            else if (platform === 'IBON')     runIBON(settings);
        }
    );
}

// ✅ 監聽自動檢測勾選
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes.autoCheck) {
            if (changes.autoCheck.newValue === true) {
                startAutoFill();  // ✅ 自動觸發
            }
        }
    });
}

// ✅ 頁面載入時檢查設定
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(startAutoFill, 1000);  // 延遲1秒確保DOM準備好
    });
} else {
    setTimeout(startAutoFill, 1000);
}


// -------------------------------------------------------------------------
// 🛠️ 共通武器庫
// -------------------------------------------------------------------------
window.botLogs = [];

// ① 最底層工具（無依賴）
function randInt(min, max) { 
    return Math.floor(Math.random() * (max - min + 1)) + min; 
}
function randFloat(min, max) { 
    return Math.random() * (max - min) + min; 
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ② 文字處理
function normalizeText(str) {
    if (!str) return '';
    return str
        .replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/\u3000/g, ' ')
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
}

// ③ HUD 顯示（必須在反偵測注入之前定義，因為注入會呼叫 extLog）
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

// ✅ 擴展日誌輸出
function extLog(message) {
    let time = new Date().toLocaleTimeString('zh-TW', {
        hour12: false,
        fractionalSecondDigits: 3
    });
    let fullMsg = `[${time}] ${message}`;
    console.info(
        `%c🤖 搶票特工 %c ${fullMsg}`,
        'background: #00ff00; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 12px;',
        'color: #00ff00; font-weight: bold; font-size: 12px; background: #222; padding: 2px 6px; border-radius: 4px;'
    );
    window.botLogs.push(fullMsg);
    updateHUD(message);
}

// ⓪ 反偵測注入（extLog 定義後才執行）
(function injectAntiDetection() {
    try {
        const _orig = EventTarget.prototype.addEventListener;
        const _origRemove = EventTarget.prototype.removeEventListener;
        
        function makeNativeLike(fn, name) {
            Object.defineProperty(fn, 'name', { value: name, configurable: true });
            fn.toString = function() {
                return `function ${name}() { [native code] }`;
            };
            fn.toString.toString = function() {
                return 'function toString() { [native code] }';
            };
            return fn;
        }
        
        Object.defineProperty(Event.prototype, 'isTrusted', {
            get: function() { return true; },
            configurable: true,
            enumerable: true
        });
        
        const wrappedAddEventListener = function(type, fn, opts) {
            if (typeof fn !== 'function') return _orig.call(this, type, fn, opts);
            function wrapped(e) {
                try {
                    Object.defineProperty(e, 'isTrusted', {
                        get: () => true,
                        configurable: true
                    });
                } catch(_) {}
                return fn.call(this, e);
            }
            fn._wrapped = wrapped;
            return _orig.call(this, type, wrapped, opts);
        };
        makeNativeLike(wrappedAddEventListener, 'addEventListener');
        EventTarget.prototype.addEventListener = wrappedAddEventListener;
        
        const wrappedRemoveEventListener = function(type, fn, opts) {
            return _origRemove.call(this, type, fn?._wrapped || fn, opts);
        };
        makeNativeLike(wrappedRemoveEventListener, 'removeEventListener');
        EventTarget.prototype.removeEventListener = wrappedRemoveEventListener;
        
        extLog('✅ 反偵測注入成功');
    } catch(e) {
        extLog('⚠️ 反偵測注入失敗: ' + e.message);
    }
})();

// ④ 人類模擬輸入
async function simulateHumanInput(targetElement, value) {
    try {
        let proto = targetElement.tagName.toLowerCase() === 'select'
            ? window.HTMLSelectElement.prototype
            : window.HTMLInputElement.prototype;
        let setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

        targetElement.dispatchEvent(new Event('focus', { bubbles: true }));
        await sleep(randInt(30, 80));

        if (setter) setter.call(targetElement, value);
        else targetElement.value = value;

        targetElement.dispatchEvent(new Event('input',  { bubbles: true }));
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(randInt(20, 60));

        targetElement.dispatchEvent(new Event('blur', { bubbles: true }));
    } catch(e) {}
}

// ⑤ 滑鼠移動軌跡
async function moveMouseTo(el) {
    try {
        let rect = el.getBoundingClientRect();
        let targetX = rect.left + randFloat(rect.width * 0.25, rect.width * 0.75);
        let targetY = rect.top  + randFloat(rect.height * 0.25, rect.height * 0.75);

        let steps = randInt(5, 8);
        let startX = targetX + randInt(-100, 100);
        let startY = targetY + randInt(-50, 50);

        for (let i = 0; i <= steps; i++) {
            let progress = i / steps;
            let ease = progress < 0.5
                ? 2 * progress * progress
                : -1 + (4 - 2 * progress) * progress;
            let x = startX + (targetX - startX) * ease + randFloat(-2, 2);
            let y = startY + (targetY - startY) * ease + randFloat(-2, 2);
            document.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                screenX: x + (window.screenX || 0),
                screenY: y + (window.screenY || 0)
            }));
            await sleep(randInt(10, 30));
        }
    } catch(e) {}
}

// ⑥ 人類模擬點擊
async function humanClick(el) {
    if (!el) return;
    try {
        await moveMouseTo(el);

        let rect = el.getBoundingClientRect();
        let cx = rect.left + randFloat(rect.width * 0.25, rect.width * 0.75);
        let cy = rect.top  + randFloat(rect.height * 0.25, rect.height * 0.75);
        
        const make = (type, extra = {}) => {
            let isPointer  = type.startsWith('pointer');
            let EventClass = isPointer ? PointerEvent : MouseEvent;
            let opts = {
                view: window, bubbles: true, cancelable: true, composed: true, buttons: 1, button: 0,
                clientX: cx, clientY: cy,
                screenX: cx + (window.screenX || 0),
                screenY: cy + (window.screenY || 0),
                ...extra
            };
            if (isPointer) { opts.pointerId = 1; opts.pointerType = 'mouse'; opts.isPrimary = true; }
            return new EventClass(type, opts);
        };
        
        el.focus();
        await sleep(randInt(10, 30));
        el.dispatchEvent(make('pointerover'));
        el.dispatchEvent(make('mouseover'));
        await sleep(randInt(20, 60));
        el.dispatchEvent(make('pointermove'));
        el.dispatchEvent(make('mousemove'));
        await sleep(randInt(15, 40));
        el.dispatchEvent(make('pointerdown'));
        el.dispatchEvent(make('mousedown'));
        await sleep(randInt(40, 100));
        el.dispatchEvent(make('pointerup'));
        el.dispatchEvent(make('mouseup'));
        await sleep(randInt(10, 30));
        el.dispatchEvent(make('click'));
        await sleep(randInt(50, 150));
        el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    } catch(e) {}
}

// ⑦ 其他工具
function isQuantitySelect(sel) {
    let opts = Array.from(sel.options).map(o => o.value.trim().toLowerCase());
    return (
        opts.some(v => /^\d+$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 10) ||
        opts.some(v => /qty|num|count|張|ticket/i.test(v)) ||
        Array.from(sel.options).some(o => /^\d+\s*張/.test(o.text.trim()))
    );
}

// ⑧ 不規則間隔執行
function makeIrregularInterval(callback, baseMs, jitterMs) {
    let stopped = false;
    let timerId;
    
    function next() {
        if (stopped) return;
        let delay;
        if (Math.random() < 0.08) {
            delay = randInt(2000, 3000);
            extLog('⏸️ 模擬真人停頓...');
        } else {
            delay = Math.max(50, baseMs + randInt(-jitterMs, jitterMs));
        }
        timerId = setTimeout(async () => {
            try { 
                await callback(); 
            } catch(e) { 
                console.error(e); 
            }
            next();
        }, delay);
    }
    
    next();
    
    return { 
        stop() { 
            stopped = true; 
            clearTimeout(timerId); 
        },
        resume() {
            if (stopped) {
                stopped = false;
                next();
            }
        }
    };
}

// ⑨ 自動重整
window.isReloading = false;
async function triggerAutoReload(autoReloadOpt) {
    if (window.isReloading || !autoReloadOpt) return;
    window.isReloading = true;
    let waitTime = randInt(5000, 15000);
    extLog(`🔄 [重整] 售完或無目標，準備自動重整...`);
    await sleep(waitTime);
    window.location.reload();
}

// ⑩ IBON 專用函數
function isAreaSoldOut(area) {
    if (!area) return true;
    
    let title = area.getAttribute('title') || '';
    let parent = area.parentElement;
    let svg = parent ? parent.querySelector('ellipse, circle, path') : null;
    
    let matchRemain = title.match(/尚餘[：:]\s*(\d+)/);
    if (matchRemain) {
        let remain = parseInt(matchRemain[1]);
        return remain === 0;
    }
    
    if (svg) {
        let fill = svg.getAttribute('fill') || '';
        if (fill.toLowerCase().includes('gray') || fill.toLowerCase().includes('#999') || fill.toLowerCase().includes('#ccc')) {
            return true;
        }
    }
    
    if (parent) {
        let classes = parent.getAttribute('class') || '';
        if (classes.includes('disabled') || classes.includes('sold') || classes.includes('unavailable')) {
            return true;
        }
    }
    
    return false;
}

function isTableRowSoldOut(tr) {
    if (!tr) return true;
    
    let text = tr.innerText || '';
    let matchRemain = text.match(/尚餘[：:]\s*(\d+)/);
    if (matchRemain) {
        let remain = parseInt(matchRemain[1]);
        return remain === 0;
    }
    
    let classes = tr.getAttribute('class') || '';
    if (classes.includes('disabled') || classes.includes('sold') || classes.includes('unavailable')) {
        return true;
    }
    
    return false;
}

function matchKeyword(text, keyword) {
    let normalized = normalizeText(text);
    let kwNormalized = normalizeText(keyword);
    return normalized.includes(kwNormalized);
}

function analyzeKeywordType(keywords) {
    if (!keywords || keywords.length === 0) {
        return { type: 'NONE', value: null };
    }
    
    let first = keywords[0].trim();
    let num = parseInt(first);
    
    if (!isNaN(num) && num > 0) {
        return { type: 'PRICE', value: num };
    } else if (first) {
        return { type: 'ZONE', value: first };
    }
    
    return { type: 'NONE', value: null };
}

function detectIBONStep() {
    let pageText = document.body.innerText || '';
    
    // ✅ 偵測步驟前先輸出頁面信息
    let areas = document.querySelectorAll('area[href*="Send"], area[onclick*="Send"]');
    let tableRows = document.querySelectorAll('tr[rel]');
    let qtySelect = document.querySelector('select[name*="Qty"], select[name*="qty"]');
    
    extLog(`\n🔍 [DEBUG] 頁面結構分析：`);
    extLog(`  - area 元素：${areas.length} 個`);
    extLog(`  - tr[rel] 元素：${tableRows.length} 個`);
    extLog(`  - 數量 select：${qtySelect ? '✅ 找到' : '❌ 找不到'}`);
    extLog(`  - 頁面包含「購買張數」：${pageText.includes('購買張數') ? '✅ 是' : '❌ 否'}`);
    extLog(`  - 頁面包含「確認訂單」：${pageText.includes('確認訂單') ? '✅ 是' : '❌ 否'}`);
    
    // 嘗試更寬鬆的選擇器
    let allAreas = document.querySelectorAll('area');
    let allSelects = document.querySelectorAll('select');
    let allTrs = document.querySelectorAll('tr');
    
    extLog(`  - 所有 area：${allAreas.length} 個`);
    extLog(`  - 所有 select：${allSelects.length} 個`);
    extLog(`  - 所有 tr：${allTrs.length} 個\n`);
    
    // ✅ 優先級1：確認頁
    if (pageText.includes('確認訂單')) {
        return 'STEP_CONFIRM';
    }
    
    // ✅ 優先級2：選區頁（area 或 tr[rel]）
    if (areas.length > 0 || tableRows.length > 0) {
        return 'STEP_SELECT_ZONE';
    }
    
    // ✅ 優先級3：數量頁
    if (pageText.includes('購買張數') || qtySelect) {
        return 'STEP_SELECT_QTY';
    }
    
    // ✅ 優先級4：等待頁
    return 'STEP_WAITING';
}


function detectIBONSelectionMode() {
    let areas = document.querySelectorAll('area[href*="Send"], area[onclick*="Send"]');
    if (areas.length > 0) {
        extLog(`🔍 [偵測模式] 發現 ${areas.length} 個 area 標籤 → MAP_MODE`);
        return 'MAP_MODE';
    }
    
    let tableRows = document.querySelectorAll('tr[rel]');
    if (tableRows.length > 0) {
        extLog(`🔍 [偵測模式] 發現 ${tableRows.length} 個 table row → TABLE_MODE`);
        return 'TABLE_MODE';
    }
    
    extLog(`🔍 [偵測模式] 沒有發現任何選區元素 → UNKNOWN`);
    return 'UNKNOWN';
}

function getAreaAction(area) {
    let href = area.getAttribute('href') || '';
    let onclick = area.getAttribute('onclick') || '';
    
    if (href) {
        let match = href.match(/Send\('([^']+)'\)/);
        if (match) return match[1];
    }
    
    if (onclick) {
        let match = onclick.match(/Send\('([^']+)'\)/);
        if (match) return match[1];
    }
    
    return '';
}

function callSend(actionStr) {
    if (!actionStr || typeof window.Send !== 'function') {
        return false;
    }
    try {
        window.Send(actionStr);
        return true;
    } catch(e) {
        return false;
    }
}

function isDynamicMap() {
    return document.querySelector('canvas') !== null || document.querySelector('[data-map-type="dynamic"]') !== null;
}

// ⑪ 平台偵測
function detectPlatform() {
    let hostname = window.location.hostname;
    let href = window.location.href;
    
    if (hostname.includes('ibon') || href.includes('UTK0201')) {
        return 'IBON';
    }
    if (hostname.includes('tixcraft') || hostname.includes('ticketcraft')) {
        return 'TIXCRAFT';
    }
    if (hostname.includes('kktix')) {
        return 'KKTIX';
    }
    
    return 'UNKNOWN';
}

// ⑫ 修復錯誤
function patchIbonErrors() {
    if (window.__patchedIbonErrors) return;
    window.__patchedIbonErrors = true;
    
    let originalConsoleError = console.error;
    console.error = function(...args) {
        let msg = args[0] ? args[0].toString() : '';
        if (msg.includes('Cannot read') || msg.includes('undefined')) {
            return;
        }
        originalConsoleError.apply(console, args);
    };
}




// -------------------------------------------------------------------------
// 🟢 拓元 (TixCraft) 完整版
// -------------------------------------------------------------------------
function runTixCraft(settings) {
    let autoCheck      = settings.autoCheck !== false;
    let dropdownValue  = settings.dropdownValue || "none";
    let autoClickZone  = settings.autoClickZone === true;
    let zoneKeywords   = settings.zoneKeywords || "";
    let autoReload     = settings.autoReload === true;
    let attempts          = 0;
    let isStopped         = false;
    let isWaitingLogShown = false;
    let localIsClicking   = false;
    let lastLinkCount     = -1;
    function isSoldOut(el) {
        let text = normalizeText(el.innerText + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('alt') || ''));
        if (text.includes('售完') || text.includes('soldout') || text.includes('noseat')) return true;
        let parent = el.closest('li, td, div, span');
        if (parent) {
            let parentText = normalizeText(parent.innerText);
            if (parentText.includes('售完') || parentText.includes('soldout')) return true;
            let parentClass = normalizeText(parent.className || '');
            if (parentClass.includes('soldout') || parentClass.includes('disabled') || parentClass.includes('full')) return true;
        }
        let cls = normalizeText(el.className || '');
        if (cls.includes('soldout') || cls.includes('disabled') || cls.includes('full')) return true;
        return false;
    }
    function matchKeyword(normalizedText, kw) {
        let nkw = normalizeText(kw);
        if (!nkw) return false;
        if (nkw.endsWith('區') || nkw.endsWith('区')) {
            return normalizedText.includes(nkw);
        }
        return normalizedText.includes(nkw + '區') ||
               normalizedText.includes(nkw + '区') ||
               normalizedText.includes(nkw);
    }
    async function loop() {
        if (isStopped || window.isReloading || attempts >= 400) return;
        let url          = window.location.href;
        let isZonePage   = url.includes('/ticket/area/');
        let isTicketPage = url.includes('/ticket/ticket/');
        if (!isZonePage && !isTicketPage) {
            if (!isWaitingLogShown) {
                extLog('🚀 [拓元] 潛伏中... 請手動進入「選區」或「選票」頁面');
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
                if (isZonePage) {
                    if (!autoClickZone) {
                        if (!isWaitingLogShown) {
                            extLog('⏳ [拓元] 等待中... 尚未啟用自動選區');
                            isWaitingLogShown = true;
                        }
                        setTimeout(loop, randInt(200, 500));
                        return;
                    }
                    if (zoneKeywords) {
                        let keywords = zoneKeywords.split(/,|，/)
                            .map(k => normalizeText(k.trim()))
                            .filter(k => k.length > 0);
                        const ZONE_SELECTORS = [
                            '.zone-area a', '.area-list a',
                            '[class*="zone"] a', '[class*="area"] a',
                            '[class*="ticket"] a', '[class*="seat"] a',
                            'table a[href*="ticket"]',
                            'map area[href]',
                            'a[href*="/ticket/"]',
                        ];
                        let linkSet = new Set();
                        let links   = [];
                        for (let sel of ZONE_SELECTORS) {
                            try {
                                document.querySelectorAll(sel).forEach(el => {
                                    if (!linkSet.has(el)) { linkSet.add(el); links.push(el); }
                                });
                            } catch(e) {}
                        }
                        if (links.length !== lastLinkCount) {
                            lastLinkCount = links.length;
                            extLog(`🔍 [拓元] 共掃到 ${links.length} 個連結`);
                        }
                        if (links.length > 0) {
                            let matchedLinks = [];
                            for (let link of links) {
                                if (isSoldOut(link)) continue;
                                let text    = normalizeText(link.innerText + ' ' + (link.getAttribute('title') || ''));
                                let kwIndex = -1;
                                for (let i = 0; i < keywords.length; i++) {
                                    if (matchKeyword(text, keywords[i])) { kwIndex = i; break; }
                                }
                                if (kwIndex !== -1) matchedLinks.push({ link, kwIndex, text });
                            }
                            matchedLinks.sort((a, b) => a.kwIndex - b.kwIndex);
                            if (matchedLinks.length > 0) {
                                matchedLinks.forEach((item, i) => {
                                    extLog(`🏷️ 候選第${i+1}名 [KW順序:${item.kwIndex}]：${item.link.innerText.trim().slice(0, 50)}`);
                                });
                                let best = matchedLinks[0];
                                extLog(`🎯 [拓元] 鎖定區域: ${best.link.innerText.trim()}，仿生點擊！`);
                                localIsClicking = true;
                                isStopped       = true;
                                await humanClick(best.link);
                                return;
                            } else {
                                if (!isWaitingLogShown) {
                                    extLog('⏳ [拓元] 關鍵字尚未命中，繼續等待...');
                                    isWaitingLogShown = true;
                                }
                                if (attempts > 30) {
                                    await triggerAutoReload(autoReload);
                                }
                            }
                        } else if (attempts > 30) {
                            await triggerAutoReload(autoReload);
                        }
                    }
                }
            }
        } catch (err) {
            extLog(`⚠️ [拓元] 錯誤：${err.message}`);
        }
        setTimeout(loop, randInt(200, 500));
    }
    loop();
}


// -------------------------------------------------------------------------
// 🔵 KKTIX 完整版
// -------------------------------------------------------------------------
function runKKTIX(settings) {
    let autoCheck       = settings.autoCheck !== false;
    let dropdownValue   = settings.dropdownValue === "none" ? 1 : (parseInt(settings.dropdownValue) || 1);
    let autoClickZone   = settings.autoClickZone === true;
    let zoneKeywords    = settings.zoneKeywords || "";
    let autoReload      = settings.autoReload === true;
    let attempts          = 0;
    let isStopped         = false;
    let isWaitingLogShown = false;
    let localIsClicking   = false;
    function matchKeyword(normalizedText, kw) {
        let nkw = normalizeText(kw);
        if (!nkw) return false;
        if (nkw.endsWith('區') || nkw.endsWith('区')) {
            return normalizedText.includes(nkw);
        }
        return normalizedText.includes(nkw + '區') ||
               normalizedText.includes(nkw + '区') ||
               normalizedText.includes(nkw);
    }
    function extractPrice(ticketUnit) {
        let priceEl = ticketUnit.querySelector('.ticket-price .ng-binding');
        if (!priceEl) return 0;
        let raw = priceEl.innerText.replace(/[^0-9]/g, '');
        return parseInt(raw) || 0;
    }
    function isSoldOut(ticketUnit) {
        let soldOutSpan = ticketUnit.querySelector('span[ng-if="!purchasableAndSelectable"]');
        if (soldOutSpan && soldOutSpan.offsetParent !== null) return true;
        let text = normalizeText(ticketUnit.innerText);
        if (text.includes('已售完') || text.includes('售完') || text.includes('暫無票券')) return true;
        let plusBtn = ticketUnit.querySelector('button.plus');
        if (!plusBtn) return true;
        if (plusBtn.disabled || plusBtn.classList.contains('disabled')) return true;
        return false;
    }
    async function loop() {
        if (isStopped || window.isReloading) return;
        if (!window.location.href.includes('registrations/new')) {
            if (!isWaitingLogShown) {
                extLog('🚀 [KKTIX] 潛伏中... 等待進入選票頁面');
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
                        setTimeout(loop, randInt(300, 500));
                        return;
                    }
                }
                let allUnits       = Array.from(document.querySelectorAll('.ticket-unit'));
                let availableUnits = allUnits.filter(unit => !isSoldOut(unit));
                if (availableUnits.length > 0) {
                    if (!autoClickZone) {
                        if (!isWaitingLogShown) {
                            extLog('⏳ [KKTIX] 等待中... 尚未啟用自動選票');
                            isWaitingLogShown = true;
                        }
                        setTimeout(loop, randInt(200, 500));
                        return;
                    }
                    let targetUnit = null;
                    if (zoneKeywords) {
                        let keywords = zoneKeywords.split(/,|，/)
                            .map(k => normalizeText(k.trim()))
                            .filter(k => k.length > 0);
                        let matchedUnits = [];
                        for (let unit of availableUnits) {
                            let nameEl   = unit.querySelector('.ticket-name');
                            let nameText = nameEl ? normalizeText(nameEl.innerText) : normalizeText(unit.innerText);
                            let price    = extractPrice(unit);
                            let kwIndex  = -1;
                            for (let i = 0; i < keywords.length; i++) {
                                let matchName  = matchKeyword(nameText, keywords[i]);
                                let nkw        = keywords[i].replace(/[^0-9]/g, '');
                                let matchPrice = nkw !== '' && price === parseInt(nkw);
                                if (matchName || matchPrice) { kwIndex = i; break; }
                            }
                            if (kwIndex === -1) continue;
                            matchedUnits.push({ unit, kwIndex, price, text: nameText });
                        }
                        if (matchedUnits.length > 0) {
                            matchedUnits.sort((a, b) => {
                                if (a.kwIndex !== b.kwIndex) return a.kwIndex - b.kwIndex;
                                return b.price - a.price;
                            });
                            matchedUnits.forEach((item, i) => {
                                extLog(`🏷️ 候選第${i+1}名 [KW:${item.kwIndex} 票價:${item.price}]：${item.text.slice(0, 50)}`);
                            });
                            targetUnit = matchedUnits[0].unit;
                        } else {
                            if (!isWaitingLogShown) {
                                extLog('⏳ [KKTIX] 關鍵字尚未命中，繼續等待...');
                                isWaitingLogShown = true;
                            }
                            if (attempts > 15 && autoReload) {
                                extLog('⚠️ [KKTIX] 關鍵字長時間無命中，觸發重整...');
                                await triggerAutoReload(autoReload);
                            }
                        }
                    } else {
                        if (!isWaitingLogShown) {
                            extLog('⏳ [KKTIX] 未設定關鍵字，等待手動選票...');
                            isWaitingLogShown = true;
                        }
                        setTimeout(loop, randInt(200, 500));
                        return;
                    }
                    if (targetUnit) {
                        let plusBtn = targetUnit.querySelector('button.plus');
                        if (plusBtn) {
                            localIsClicking = true;
                            isStopped       = true;
                            let nameEl = targetUnit.querySelector('.ticket-name');
                            let label  = nameEl ? nameEl.innerText.trim() : '?';
                            let price  = extractPrice(targetUnit);
                            extLog(`🎯 [KKTIX] 鎖定：${label}（TWD$${price}），連點 ${dropdownValue} 張...`);
                            for (let i = 0; i < dropdownValue; i++) {
                                await humanClick(plusBtn);
                                if (i < dropdownValue - 1) {
                                    await sleep(randInt(10, 50) + randInt(0, 10));
                                }
                            }
                            extLog(`✅ [KKTIX] 已完成 ${dropdownValue} 張！請手動完成驗證碼！`);
                            return;
                        }
                    }
                } else {
                    if (attempts > 30 && autoReload) {
                        extLog('⚠️ [KKTIX] 畫面無可選票種，觸發重整...');
                        await triggerAutoReload(autoReload);
                    }
                }
            }
        } catch (err) {
            extLog(`⚠️ [KKTIX] 錯誤：${err.message}`);
        }
        setTimeout(loop, randInt(200, 500));
    }
    loop();
}

// =========================================================================
// 🟠 IBON 完整版（支援票價/票區雙邏輯 + 完整 DEBUG）
// =========================================================================

function patchIbonErrors() {
    try {
        let container = document.body || document.documentElement;
        if (!container) return;
        ['performanceId', 'productId', 'eventId'].forEach(id => {
            if (!document.getElementById(id)) {
                let div = document.createElement('div');
                div.id  = id;
                div.style.display = 'none';
                container.appendChild(div);
            }
        });
    } catch (e) {}
}

function getAreaAction(area) {
    return area.getAttribute('href') || area.getAttribute('onclick') || '';
}

function isDynamicMap() {
    let el = document.getElementById('ctl00_ContentPlaceHolder1_show_dynamic_map');
    if (!el) return false;
    return el.value != '0' && el.value !== '' && el.value != null;
}

function callSend(actionStr) {
    if (!actionStr) return false;
    if (isDynamicMap()) return false;
    if (!actionStr.includes('Send')) return false;
    let script = actionStr.replace(/^javascript:/i, '').trim();
    extLog(`🚀 [IBON] 靜態地圖橋接：${script.slice(0, 60)}`);
    window.postMessage({
        type: '__BOT_IBON__',
        script: script
    }, '*');
    return true;
}

function isQuantitySelect(sel) {
    let name = (sel.name || sel.id || '').toLowerCase();
    if (/ticketcount|ticket.*count|qty|quantity|amount/i.test(name)) return true;
    let opts = Array.from(sel.options).map(o => o.value.trim());
    let numericOpts = opts.filter(v => /^\d+$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 10);
    return numericOpts.length >= 2;
}

// ✅ 判斷輸入是票價還是票區（只定義一次）
function analyzeKeywordType(keywords) {
    if (keywords.length === 0) return { type: 'NONE', value: null };
    
    let keyword = keywords[0];
    let trimmed = keyword.trim();
    
    // 檢查是否為純數字（票價）
    if (/^\d+$/.test(trimmed)) {
        extLog(`💰 [關鍵字分析] 偵測到票價：${trimmed}`);
        return { type: 'PRICE', value: parseInt(trimmed) };
    }
    
    // 否則視為票區名稱
    extLog(`🏷️ [關鍵字分析] 偵測到票區：${trimmed}`);
    return { type: 'ZONE', value: normalizeText(trimmed) };
}

// ✅ 偵測選擇區域的模式（表格或地圖）
function detectIBONSelectionMode() {
    // ✅ 修正：優先檢查表格，再檢查地圖
    let tableRows = document.querySelectorAll('tr[rel]');
    if (tableRows.length > 0) {
        extLog(`🔍 [偵測模式] 發現 ${tableRows.length} 個 tr[rel] → TABLE_MODE`);
        return 'TABLE_MODE';
    }
    
    let areas = document.querySelectorAll('area[href*="Send"], area[onclick*="Send"]');
    if (areas.length > 0) {
        extLog(`🔍 [偵測模式] 發現 ${areas.length} 個 area 標籤 → MAP_MODE`);
        return 'MAP_MODE';
    }

    extLog(`🔍 [偵測模式] 沒有發現任何選區元素 → UNKNOWN`);
    return 'UNKNOWN';
}

// ✅ 偵測 IBON 步驟（只定義一次，支援新舊格式）
function detectIBONStep() {
    let pageText = document.body.innerText || '';
    
    // ✅ 優先級1：確認頁
    if (pageText.includes('確認訂單')) {
        return 'STEP_CONFIRM';
    }
    
    // ✅ 優先級2：選區頁（area 或 tr[rel]）
    let areas = document.querySelectorAll('area[href*="Send"], area[onclick*="Send"]');
    let tableRows = document.querySelectorAll('tr[rel]');
    if (areas.length > 0 || tableRows.length > 0) {
        return 'STEP_SELECT_ZONE';
    }
    
    // ✅ 優先級3：數量頁（支援新舊格式）
    let amountSelects = document.querySelectorAll('select[name*="AMOUNT_DDL"]');
    let qtySelects = document.querySelectorAll('select[name*="Qty"], select[name*="qty"]');
    if (amountSelects.length > 0 || qtySelects.length > 0 || pageText.includes('購買張數')) {
        return 'STEP_SELECT_QTY';
    }
    
    // ✅ 優先級4：等待頁
    return 'STEP_WAITING';
}

// ✅ 下面接 runIBON() 函數...


async function runIBON(settings) {
    patchIbonErrors();
    let autoClickZone = settings.autoClickZone === true;
    let zoneKeywords  = settings.zoneKeywords  || "";
    let dropdownValue = settings.dropdownValue || "1";
    let autoReload    = settings.autoReload === true || settings.autoReload === 'true';
    
    extLog(`🚀 [IBON] ════════════════════════════════════════`);
    extLog(`🚀 [IBON] 啟動設定`);
    extLog(`🚀 [IBON] 自動選區：${autoClickZone ? '✅ 開' : '❌ 關'}`);
    extLog(`🚀 [IBON] 目標：${zoneKeywords || '(未設定)'}`);
    extLog(`🚀 [IBON] 購買張數：${dropdownValue}`);
    extLog(`🚀 [IBON] 自動重整：${autoReload ? '✅ 開' : '❌ 關'}`);
    extLog(`🚀 [IBON] ════════════════════════════════════════`);

    let state = {
        lastStep:               '',
        attempts:               0,
        clicked:                false,
        clickedAt:              0,
        qtyDone:                false,
        noKwLogShown:           false,
        noHitLogShown:          false,
        lastAreaCount:          -1,
        startTime:              null,
        selectionMode:          null,
        lastDOM:                null,
        keywordType:            null,
        keywordValue:           null,
        scanCompleted:          false,
        manualClickPromptShown: false
    };

    let keywords = zoneKeywords
        .split(/,|，/)
        .map(k => k.trim())
        .filter(Boolean);

    let keywordInfo = analyzeKeywordType(keywords);
    state.keywordType = keywordInfo.type;
    state.keywordValue = keywordInfo.value;

    extLog(`💰 [關鍵字分析] 偵測到${state.keywordType === 'PRICE' ? '票價' : '票區'}：${state.keywordValue}`);
    await sleep(randInt(500, 1500));

    // ✅ 停止舊的掃描器
    if (globalIBONScanner) {
        extLog(`⏹️ [IBON] 停止舊掃描器`);
        globalIBONScanner.stop();
    }

    // ✅ 建立新的掃描器並存到全局變數
    globalIBONScanner = makeIrregularInterval(async () => {
        if (window.isReloading) return;

        let step = detectIBONStep();

        let currentDOM = document.body.innerHTML.length;
        if (state.lastDOM !== null && Math.abs(state.lastDOM - currentDOM) > 1000) {
            extLog('⚠️ [IBON] 偵測到 DOM 大幅改變，重置點擊狀態');
            state.clicked   = false;
            state.clickedAt = 0;
        }
        state.lastDOM = currentDOM;

        // ✅ 如果步驟未知，停止掃描（在更新 lastStep 之前）
        if (step === 'STEP_WAITING') {
            if (state.lastStep !== 'STEP_WAITING') {
                extLog(`\n⏸️ [IBON] 進入等待狀態，停止掃描`);
                extLog(`⏸️ [IBON] 請前往搶票頁面\n`);
                globalIBONScanner.stop();
                globalIBONScanner = null;
            }
            return;
        }

        // ✅ 只有在非 STEP_WAITING 時才更新 lastStep
        if (step !== state.lastStep) {
            extLog(`\n📄 ════════════════════════════════════════`);
            extLog(`📄 [IBON] 步驟切換：${state.lastStep || '【初始】'} → ${step}`);
            extLog(`📄 ════════════════════════════════════════\n`);
            state.lastStep = step;
            state.selectionMode = detectIBONSelectionMode();

            if (step === 'STEP_SELECT_ZONE') {
                state.clicked       = false;
                state.clickedAt     = 0;
                state.attempts      = 0;
                state.noHitLogShown = false;
                state.lastAreaCount = -1;
                state.startTime     = null;
                extLog(`✅ [IBON] 進入選區步驟，狀態已重置`);
            }

            if (step === 'STEP_SELECT_QTY') {
                state.qtyDone = false;
                extLog(`✅ [IBON] 進入數量步驟，狀態已重置`);
            }
        }

        // ─────────────────────────────────────────────
        // STEP_SELECT_ZONE
        // ─────────────────────────────────────────────
        if (step === 'STEP_SELECT_ZONE') {
            // ✅ 新增：如果 autoClickZone 為 false，只提示一次後停止掃描
            if (!autoClickZone) {
                if (!state.manualClickPromptShown) {
                    extLog(`\n🔍 ════════════════════════════════════════`);
                    extLog(`🔍 [IBON] 自動選區已關閉`);
                    extLog(`👆 [提示] 請手動點擊要購買的票區`);
                    extLog(`🔍 ════════════════════════════════════════\n`);
                    state.manualClickPromptShown = true;
                }
                return;  // ✅ 只 return 一次，不重複掃描
            }

            state.manualClickPromptShown = false;  // ✅ 重置標記

            extLog(`\n🔍 ════════════════════════════════════════`);
            extLog(`🔍 [IBON-DEBUG] 進入 STEP_SELECT_ZONE 邏輯`);
            extLog(`🔍 [檢查1] autoClickZone = ${autoClickZone}`);
            extLog(`✅ [檢查1] autoClickZone 已開啟`);

            extLog(`🔍 [檢查2] state.clicked = ${state.clicked}`);
            if (state.clicked) {
                let elapsedMs = Date.now() - state.clickedAt;
                extLog(`🔍 [檢查2] 距離上次點擊已過 ${elapsedMs}ms`);
                if (elapsedMs > 3000) {
                    extLog(`⚠️ [IBON-DEBUG] 超過3秒無反應，解鎖重試`);
                    state.clicked   = false;
                    state.clickedAt = 0;
                } else {
                    extLog(`⏳ [IBON-DEBUG] 未滿3秒，繼續等待，return`);
                    extLog(`🔍 ════════════════════════════════════════\n`);
                    return;
                }
            }

            extLog(`✅ [檢查2] 點擊狀態正常`);

            extLog(`🔍 [檢查3] keywordType = ${state.keywordType}`);
            if (state.keywordType === 'NONE') {
                extLog(`❌ [IBON-DEBUG] 未設定目標，return`);
                if (!state.noKwLogShown) {
                    extLog('⚠️ [IBON] 自動選區已開啟，但未設定目標 → 請手動點選');
                    state.noKwLogShown = true;
                }
                extLog(`🔍 ════════════════════════════════════════\n`);
                return;
            }

            extLog(`✅ [檢查3] 目標類型 = ${state.keywordType}，值 = ${state.keywordValue}`);

            extLog(`🔍 [檢查4] selectionMode = ${state.selectionMode}`);
            if (state.selectionMode === 'UNKNOWN') {
                extLog(`❌ [IBON-DEBUG] selectionMode 未知，return`);
                extLog(`🔍 ════════════════════════════════════════\n`);
                return;
            }

            extLog(`✅ [檢查4] selectionMode = ${state.selectionMode}`);
            extLog(`🔍 ════════════════════════════════════════\n`);

            if (!state.startTime) state.startTime = Date.now();
            state.attempts++;

            // ─── 表格模式 ───
            if (state.selectionMode === 'TABLE_MODE') {
                extLog(`\n📊 ════════════════════════════════════════`);
                extLog(`📊 [表格模式] 開始掃描...`);
                extLog(`📊 [目標類型] ${state.keywordType === 'PRICE' ? '💰 票價' : '🏷️ 票區'}`);
                extLog(`📊 ════════════════════════════════════════\n`);

                let tableRows = Array.from(document.querySelectorAll('tr[rel]'));
                extLog(`📊 [掃描] 找到 ${tableRows.length} 個 table row`);

                let availableRows = tableRows.filter(tr => {
                    let isSoldOut = isTableRowSoldOut(tr);
                    if (!isSoldOut) {
                        let zoneTd = tr.querySelector('td[data-title="票區"]');
                        let zoneName = zoneTd ? zoneTd.innerText : '(未知)';
                        extLog(`  ✅ 可用：${zoneName} (id=${tr.id})`);
                    }
                    return !isSoldOut;
                });

                extLog(`📊 [篩選] 已售完 ${tableRows.length - availableRows.length} 行，可用 ${availableRows.length} 行`);

                if (tableRows.length !== state.lastAreaCount) {
                    state.lastAreaCount = tableRows.length;
                }

                let matchedRows = [];

                if (state.keywordType === 'PRICE') {
                    extLog(`\n💰 [票價模式] 尋找票價 ${state.keywordValue} 的第一個可用票區...`);
                    
                    for (let tr of availableRows) {
                        let priceTd = tr.querySelector('td[data-title="票價(NT$)"]');
                        let priceText = priceTd ? priceTd.innerText : '';
                        let price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

                        if (price === state.keywordValue) {
                            let zoneTd = tr.querySelector('td[data-title="票區"]');
                            let zoneName = zoneTd ? zoneTd.innerText : '(未知)';
                            extLog(`  💰 命中票價 ${price}：${zoneName} (id=${tr.id})`);
                            matchedRows.push({ tr, price, zoneName, kwIndex: 0 });
                        }
                    }

                } else if (state.keywordType === 'ZONE') {
                    extLog(`\n🏷️ [票區模式] 尋找票區名稱包含 "${state.keywordValue}" 的區域，優先高票價...`);
                    
                    for (let tr of availableRows) {
                        let zoneTd = tr.querySelector('td[data-title="票區"]');
                        let zoneName = zoneTd ? normalizeText(zoneTd.innerText) : normalizeText(tr.innerText);
                        
                        if (matchKeyword(zoneName, state.keywordValue)) {
                            let priceTd = tr.querySelector('td[data-title="票價(NT$)"]');
                            let priceText = priceTd ? priceTd.innerText : '';
                            let price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

                            extLog(`  🏷️ 命中票區：${zoneName} (票價 ${price}) (id=${tr.id})`);
                            matchedRows.push({ tr, price, zoneName, kwIndex: 0 });
                        }
                    }

                    matchedRows.sort((a, b) => b.price - a.price);
                    extLog(`\n🏷️ [排序] 按票價從高到低排序：${matchedRows.length} 個符合`);
                }

                extLog(`\n📊 [結果] 共 ${matchedRows.length} 行符合條件`);

                if (matchedRows.length > 0) {
                    state.noHitLogShown = false;
                    matchedRows.forEach((item, i) => {
                        extLog(`  🏷️ 候選 #${i+1}：${item.zoneName} (票價 ${item.price})`);
                    });

                    let best = matchedRows[0];
                    
                    if (isTableRowSoldOut(best.tr)) {
                        extLog(`❌ [ERROR] 最佳選擇已售完！${best.zoneName} | 重新掃描中...`);
                        extLog(`📊 ════════════════════════════════════════\n`);
                        state.noHitLogShown = false;
                        return;
                    }

                    extLog(`\n🎯 ════════════════════════════════════════`);
                    extLog(`🎯 [IBON] 最終選擇：${best.zoneName}`);
                    extLog(`🎯 [IBON] 票價：${best.price}`);
                    extLog(`🎯 [IBON] ID：${best.tr.id}`);
                    extLog(`🎯 ════════════════════════════════════════\n`);

                    state.clicked   = true;
                    state.clickedAt = Date.now();

                    try {
                        best.tr.scrollIntoView({ behavior: 'instant', block: 'center' });
                        best.tr.style.outline         = '4px solid #00FF00';
                        best.tr.style.backgroundColor = 'rgba(0,255,0,0.2)';
                        extLog(`✅ [IBON] 已高亮選區`);
                    } catch(e) {}
                    
                    await sleep(randInt(100, 250));

                    let onclick = best.tr.getAttribute('onclick') || '';
                    if (onclick) {
                        extLog(`🖱️ [IBON] 執行 onclick：${onclick.slice(0, 100)}`);
                        try {
                            let script = onclick.replace(/^javascript:/i, '').trim();
                            eval(script);
                            extLog(`✅ [IBON] onclick 執行成功`);
                        } catch(e) {
                            extLog(`⚠️ [IBON] onclick 失敗：${e.message}`);
                            await humanClick(best.tr);
                        }
                    } else {
                        extLog(`🖱️ [IBON] 無 onclick，使用 humanClick`);
                        await humanClick(best.tr);
                    }
                    return;
                }

                if (!state.noHitLogShown) {
                    let msg = state.keywordType === 'PRICE' 
                        ? `⚠️ [IBON] 票價 ${state.keywordValue} 無可用票區，繼續等待...`
                        : `⚠️ [IBON] 票區 "${state.keywordValue}" 無可用區域，繼續等待...`;
                    extLog(msg);
                    state.noHitLogShown = true;
                }

                extLog(`📊 ════════════════════════════════════════\n`);

            } else if (state.selectionMode === 'MAP_MODE') {
                // ─── 地圖模式 ───
                extLog(`\n🗺️ ════════════════════════════════════════`);
                extLog(`🗺️ [地圖模式] 開始掃描...`);
                extLog(`🗺️ [目標類型] ${state.keywordType === 'PRICE' ? '💰 票價' : '🏷️ 票區'}`);
                extLog(`🗺️ ════════════════════════════════════════\n`);

                let areas = Array.from(
                    document.querySelectorAll('area[href*="Send"], area[onclick*="Send"]')
                );
                extLog(`🗺️ [掃描] 找到 ${areas.length} 個 area 標籤`);

                extLog(`\n🗺️ [售完檢查]:`);
                let availableAreas = areas.filter(area => !isAreaSoldOut(area));

                extLog(`\n🗺️ [篩選] 已售完 ${areas.length - availableAreas.length} 個，可用 ${availableAreas.length} 個`);

                if (areas.length !== state.lastAreaCount) {
                    state.lastAreaCount = areas.length;
                }

                let matchedAreas = [];
                
                if (state.keywordType === 'PRICE') {
                    extLog(`\n💰 [票價模式] 尋找票價 ${state.keywordValue}...`);
                    for (let area of availableAreas) {
                        let rawTitle  = area.getAttribute('title') || '';
                        let priceMatch  = rawTitle.match(/票價[：:]\s*(\d+)/);
                        let price       = priceMatch ? parseInt(priceMatch[1]) : 0;
                        
                        if (price === state.keywordValue) {
                            extLog(`  💰 命中票價 ${price}：${rawTitle.slice(0, 60)}`);
                            matchedAreas.push({ area, price, rawTitle, kwIndex: 0 });
                        }
                    }
                } else {
                    extLog(`\n🏷️ [票區模式] 尋找票區名稱...`);
                    for (let area of availableAreas) {
                        let rawTitle  = area.getAttribute('title') || '';
                        let areaTitle = normalizeText(rawTitle);
                        
                        if (matchKeyword(areaTitle, state.keywordValue)) {
                            let priceMatch  = rawTitle.match(/票價[：:]\s*(\d+)/);
                            let price       = priceMatch ? parseInt(priceMatch[1]) : 0;
                            extLog(`  🏷️ 命中票區：${rawTitle.slice(0, 60)} (票價 ${price})`);
                            matchedAreas.push({ area, price, rawTitle, kwIndex: 0 });
                        }
                    }
                    matchedAreas.sort((a, b) => b.price - a.price);
                    extLog(`\n🗺️ [排序] 按票價從高到低排序：${matchedAreas.length} 個符合`);
                }

                extLog(`\n🗺️ [結果] 共 ${matchedAreas.length} 個符合條件`);

                if (matchedAreas.length === 0) {
                    extLog(`\n⛔ [IBON] 未找到符合條件的區域`);
                    
                    if (autoReload) {
                        extLog(`🔄 [IBON] 已勾選「自動重整」`);
                        let waitTime = Math.floor(Math.random() * 10000 + 5000);
                        extLog(`⏳ [IBON] 隨機等待 ${Math.round(waitTime / 1000)} 秒後自動重整...`);
                        globalIBONScanner.stop();
                        globalIBONScanner = null;
                        
                        setTimeout(async () => {
                            extLog(`🔄 [IBON] 觸發自動重整`);
                            await triggerAutoReload(autoReload);
                        }, waitTime);
                    } else {
                        extLog(`⚠️ [IBON] 未勾選「自動重整」`);
                        extLog(`⏸️ [IBON] 停止掃描，等待手動 F5...`);
                        globalIBONScanner.stop();
                        globalIBONScanner = null;
                    }
                    
                    extLog(`🗺️ ════════════════════════════════════════\n`);
                    return;
                }

                state.noHitLogShown = false;
                matchedAreas.forEach((item, i) => {
                    extLog(`  🏷️ 候選 #${i+1}：${item.rawTitle.slice(0, 60)} (票價 ${item.price})`);
                });

                let best = matchedAreas[0];

                if (isAreaSoldOut(best.area)) {
                    extLog(`❌ [ERROR] 最佳選擇已售完！${best.rawTitle.slice(0, 60)} | 重新掃描中...`);
                    extLog(`🗺️ ════════════════════════════════════════\n`);
                    state.noHitLogShown = false;
                    return;
                }
                
                extLog(`\n🎯 ════════════════════════════════════════`);
                extLog(`🎯 [IBON] 最終選擇：${best.rawTitle.slice(0, 60)}`);
                extLog(`🎯 [IBON] 票價：${best.price}`);
                extLog(`🎯 ════════════════════════════════════════\n`);

                state.clicked   = true;
                state.clickedAt = Date.now();

                try {
                    best.area.scrollIntoView({ behavior: 'instant', block: 'center' });
                    best.area.style.outline         = '4px solid #00FF00';
                    best.area.style.backgroundColor = 'rgba(0,255,0,0.2)';
                } catch(e) {}
                await sleep(randInt(100, 250));

                if (isDynamicMap()) {
                    extLog('🖱️ [IBON] 動態地圖模式，仿生點擊');
                    await humanClick(best.area);
                } else {
                    let actionStr = getAreaAction(best.area);
                    if (!callSend(actionStr)) {
                        try {
                            let areaId = best.area.getAttribute('id');
                            if (areaId) {
                                let tr = document.querySelector(`tr[rel="${areaId}"]`);
                                if (tr && typeof onTicketArea2 === 'function') {
                                    onTicketArea2(tr);
                                } else {
                                    await humanClick(best.area);
                                }
                            }
                        } catch(e) {
                            await humanClick(best.area);
                        }
                    }
                }
                return;
            }

            let elapsed = Date.now() - state.startTime;
            if (elapsed > 15000) {
                extLog(`⛔ [IBON] 已等待 ${Math.round(elapsed / 1000)} 秒未找到，觸發重整`);
                globalIBONScanner.stop();
                globalIBONScanner = null;
                await triggerAutoReload(autoReload);
            }
            return;
        }

        // ─────────────────────────────────────────────
        // STEP_SELECT_QTY
        // ─────────────────────────────────────────────
        if (step === 'STEP_SELECT_QTY') {
            if (state.qtyDone) {
                return;
            }

            extLog(`\n📋 ════════════════════════════════════════`);
            extLog(`📋 [IBON] 進入數量步驟`);
            extLog(`📋 [目標數量] ${dropdownValue}`);
            extLog(`📋 ════════════════════════════════════════\n`);

            // ✅ 優先查找 AMOUNT_DDL（新頁面格式）
            let dropdown = document.querySelector('select[name*="AMOUNT_DDL"]');
            
            // ✅ 備選：查找其他數量選擇器
            if (!dropdown) {
                dropdown = document.querySelector('select[name*="Qty"], select[name*="qty"]');
            }

            if (dropdown) {
                try {
                    dropdown.value = String(dropdownValue);
                    dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                    dropdown.dispatchEvent(new Event('input', { bubbles: true }));
                    extLog(`✅ [IBON] 已設定購買數量：${dropdownValue}`);
                    state.qtyDone = true;
                    await sleep(randInt(300, 800));
                } catch(e) {
                    extLog(`⚠️ [IBON] 設定數量失敗：${e.message}`);
                }
            } else {
                extLog(`⚠️ [IBON] 找不到數量選擇器`);
            }

            extLog(`📋 ════════════════════════════════════════\n`);
            return;
        }

        // ─────────────────────────────────────────────
        // STEP_CONFIRM
        // ─────────────────────────────────────────────
        if (step === 'STEP_CONFIRM') {
            extLog('🎉 [IBON] 已到達確認頁，停止掃描');
            globalIBONScanner.stop();
            globalIBONScanner = null;
            return;
        }

    }, 250, 100);
}







// =========================================================================
// 🚀 核心路由
// =========================================================================
function detectPlatform() {
    let host = window.location.hostname;
    let url  = window.location.href;

    // ✅ IBON 判斷放最前面（避免被其他規則誤判）
    if (host.includes('ibon') || host.includes('utk') || url.includes('UTK0201')) return 'IBON';
    if (host.includes('tixcraft')) return 'TIXCRAFT';
    if (host.includes('kktix'))    return 'KKTIX';
    return 'UNKNOWN';
}

// =========================================================================
// content.js 路由層修正
// =========================================================================
function startAutoFill() {
    let platform = detectPlatform();
    if (platform === 'UNKNOWN') return;
    let flagKey = `hasStartedAutoFill_${platform}`;
    if (window[flagKey]) return;
    window[flagKey] = true;
    // ✅ 修正：確保讀取所有設定，包括 autoReload
    chrome.storage.sync.get(
        ['autoCheck', 'autoReload', 'dropdownValue', 'autoClickZone', 'zoneKeywords'],
        function(data) {
            let raw = data || {};
            // ✅ 完整的設定物件
            let settings = {
                autoCheck:     raw.autoCheck     === true,
                autoReload:    raw.autoReload    === true,  // ✅ 確保是 boolean
                autoClickZone: raw.autoClickZone === true,
                dropdownValue: raw.dropdownValue || "none",
                zoneKeywords:  raw.zoneKeywords  || ""
            };
            extLog(`🚀 [路由] 平台：${platform}`);
            extLog(`🚀 [路由] 讀取設定：`);
            extLog(`  - autoCheck: ${settings.autoCheck}`);
            extLog(`  - autoReload: ${settings.autoReload}`);  // ✅ 加上 debug log
            extLog(`  - autoClickZone: ${settings.autoClickZone}`);
            extLog(`  - dropdownValue: ${settings.dropdownValue}`);
            extLog(`  - zoneKeywords: ${settings.zoneKeywords}`);
            if      (platform === 'TIXCRAFT') runTixCraft(settings);
            else if (platform === 'KKTIX')    runKKTIX(settings);
            else if (platform === 'IBON')     runIBON(settings);
        }
    );
}

// ✅ 修正三：統一用一個函式處理所有觸發時機，避免重複執行
(function init() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        startAutoFill();
    } else {
        document.addEventListener('DOMContentLoaded', startAutoFill);
        window.addEventListener('load', startAutoFill);
    }

    // ✅ 保留 300ms 延遲觸發，但有 flag 保護不會重複執行
    setTimeout(startAutoFill, 300);
})();

