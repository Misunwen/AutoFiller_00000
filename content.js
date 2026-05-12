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
// -------------------------------------------------------------------------
// 🛠️ 共通武器庫
// -------------------------------------------------------------------------
window.botLogs = [];

// ① 最底層工具（無依賴）
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }
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
function extLog(msg) {
    let time = new Date().toLocaleTimeString('zh-TW', {
        hour12: false,
        fractionalSecondDigits: 3
    });
    let fullMsg = `[${time}] ${msg}`;
    console.info(
        `%c🤖 搶票特工 %c ${fullMsg}`,
        'background: #00ff00; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 12px;',
        'color: #00ff00; font-weight: bold; font-size: 12px; background: #222; padding: 2px 6px; border-radius: 4px;'
    );
    window.botLogs.push(fullMsg);
    updateHUD(msg);
}

// ⓪ 反偵測注入（extLog 定義後才執行）
(function injectAntiDetection() {
    try {
        // ✅ 對策一：讓 toString() 看起來像原生函式
        const _orig = EventTarget.prototype.addEventListener;
        const _origRemove = EventTarget.prototype.removeEventListener;
        function makeNativeLike(fn, name) {
            // 覆蓋 toString 讓它回傳原生函式字串
            Object.defineProperty(fn, 'name', { value: name, configurable: true });
            fn.toString = function() {
                return `function ${name}() { [native code] }`;
            };
            // 讓 toString 本身也看起來正常
            fn.toString.toString = function() {
                return 'function toString() { [native code] }';
            };
            return fn;
        }
        // ✅ 對策二：覆蓋 isTrusted
        Object.defineProperty(Event.prototype, 'isTrusted', {
            get: function() { return true; },
            configurable: true,
            enumerable: true
        });
        // ✅ 對策三：攔截 addEventListener 並偽裝成原生
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
        // ✅ 對策四：攔截 removeEventListener 並偽裝成原生
        const wrappedRemoveEventListener = function(type, fn, opts) {
            return _origRemove.call(this, type, fn?._wrapped || fn, opts);
        };
        makeNativeLike(wrappedRemoveEventListener, 'removeEventListener');
        EventTarget.prototype.removeEventListener = wrappedRemoveEventListener;
        // ✅ 對策五：網站用 new Event() 測試 isTrusted 時也回傳 true
        // 已經被 Event.prototype 的 getter 覆蓋處理
        extLog('✅ 反偵測注入成功');
    } catch(e) {
        extLog('⚠️ 反偵測注入失敗: ' + e.message);
    }
})();

// ④ 人類模擬輸入（依賴 sleep, randInt）
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

// ⑤ 滑鼠移動軌跡（依賴 sleep, randInt, randFloat）
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

// ⑥ 人類模擬點擊（依賴 moveMouseTo, sleep, randInt, randFloat）
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
    
    // 更寬鬆的判斷
    return (
        // 數字型 value
        opts.some(v => /^\d+$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 10) ||
        // 含數字的 value
        opts.some(v => /qty|num|count|張|ticket/i.test(v)) ||
        // 選項文字包含張數
        Array.from(sel.options).some(o => /^\d+\s*張/.test(o.text.trim()))
    );
}
function makeIrregularInterval(callback, baseMs, jitterMs) {
    let stopped = false; let timerId;
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
            try { await callback(); } catch(e) { console.error(e); }
            next();
        }, delay);
    }
    next();
    return { stop() { stopped = true; clearTimeout(timerId); } };
}

// ⑧ 自動重整
window.isReloading = false;
async function triggerAutoReload(autoReloadOpt) {
    if (window.isReloading || !autoReloadOpt) return;
    window.isReloading = true;
    let waitTime = randInt(5000, 15000);
    extLog(`🔄 [重整] 售完或無目標，準備自動重整...`);
    await sleep(waitTime);
    window.location.reload();
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
                                    await sleep(randInt(150, 400) + randInt(0, 80));
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

// -------------------------------------------------------------------------
// 🟠 IBON 完整版（修正版）
// -------------------------------------------------------------------------
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
// ✅ 修正一：isQuantitySelect 更嚴謹
function isQuantitySelect(sel) {
    // IBON 數量選單通常 name/id 包含這些關鍵字
    let name = (sel.name || sel.id || '').toLowerCase();
    if (/ticketcount|ticket.*count|qty|quantity/i.test(name)) return true;
    // 備用：選項全為純數字且範圍在 1~10，且至少有兩個
    let opts = Array.from(sel.options).map(o => o.value.trim());
    let numericOpts = opts.filter(v => /^\d+$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 10);
    return numericOpts.length >= 2;
}
// ✅ 修正二：detectIBONStep 判斷順序調整（確認頁 → 數量 → 選區）
function detectIBONStep() {
    // 先判斷確認頁（最終態）
    if (document.querySelector('#btnPay, .btn-pay, [id*="pay" i]'))
        return 'STEP_CONFIRM';
    // 再判斷數量選擇（中間態）
    let qtySelects = Array.from(document.querySelectorAll('select:not([disabled])'))
                         .filter(isQuantitySelect);
    if (qtySelects.length > 0) return 'STEP_SELECT_QTY';
    // 最後判斷選區（初始態）
    let areas = document.querySelectorAll('area[href*="Send"], area[onclick*="Send"]');
    if (areas.length > 0) return 'STEP_SELECT_ZONE';
    return 'STEP_WAITING';
}
function runIBON(settings) {
    patchIbonErrors();
    let autoClickZone = settings.autoClickZone === true;
    let zoneKeywords  = settings.zoneKeywords  || "";
    let dropdownValue = settings.dropdownValue || "none";
    let autoReload    = settings.autoReload    === true;
    extLog(`🚀 [IBON] 啟動 | 自動選區：${autoClickZone ? '開' : '關'} | 目標：${zoneKeywords || '無'} | 張數：${dropdownValue}`);
    let state = {
        lastStep:      '',
        attempts:      0,
        clicked:       false,
        clickedAt:     0,          // ✅ 修正三：記錄點擊時間
        qtyDone:       false,
        noKwLogShown:  false,
        noHitLogShown: false,
        lastAreaCount: -1,
        startTime:     null        // ✅ 修正四：記錄開始掃描時間
    };
    let keywords = zoneKeywords
        .split(/,|，/)
        .map(k => normalizeText(k.trim()))
        .filter(Boolean);
    function matchKeyword(normalizedTitle, kw) {
        let nkw = normalizeText(kw);
        if (!nkw) return false;
        if (nkw.endsWith('區') || nkw.endsWith('区')) {
            return normalizedTitle.includes(nkw);
        }
        return normalizedTitle.includes(nkw + '區') ||
               normalizedTitle.includes(nkw + '区') ||
               normalizedTitle.includes(nkw);
    }
    let scanner = makeIrregularInterval(async () => {
        if (window.isReloading) return;
        let step = detectIBONStep();
        if (step !== state.lastStep) {
            extLog(`📄 [IBON] 步驟切換：${state.lastStep || '初始'} → ${step}`);
            state.lastStep = step;
            if (step === 'STEP_SELECT_ZONE') {
                state.clicked       = false;
                state.clickedAt     = 0;
                state.attempts      = 0;
                state.noHitLogShown = false;
                state.lastAreaCount = -1;
                state.startTime     = null; // ✅ 重置計時器
            }
            if (step === 'STEP_SELECT_QTY') {
                state.qtyDone = false; // ✅ 進入數量步驟時重置
            }
        }
        // ─────────────────────────────────────────────
        // STEP_SELECT_ZONE
        // ─────────────────────────────────────────────
        if (step === 'STEP_SELECT_ZONE') {
            if (!autoClickZone) return;
            // ✅ 修正三：點擊後超過 3 秒沒跳轉 → 解鎖重試
            if (state.clicked) {
                if (Date.now() - state.clickedAt > 3000) {
                    extLog('⚠️ [IBON] 點擊後無反應，解鎖重試...');
                    state.clicked   = false;
                    state.clickedAt = 0;
                } else {
                    return;
                }
            }
            if (keywords.length === 0) {
                if (!state.noKwLogShown) {
                    extLog('⚠️ [IBON] 自動選區已開啟，但未設定關鍵字 → 請手動點選');
                    state.noKwLogShown = true;
                }
                return;
            }
            // ✅ 修正四：改用時間判斷是否觸發重整
            if (!state.startTime) state.startTime = Date.now();
            state.attempts++;
            let areas = Array.from(
                document.querySelectorAll('area[href*="Send"], area[onclick*="Send"]')
            );
            let availableAreas = areas.filter(area => {
                let title = area.getAttribute('title') || '';
                if (!title || title.trim() === '') return false;
                if (title.includes('已售完') || title.includes('售完')) return false;
                let remainMatch = title.match(/尚餘[：:]\s*(\d+)/);
                if (remainMatch && parseInt(remainMatch[1]) === 0) return false;
                return true;
            });
            if (areas.length !== state.lastAreaCount) {
                state.lastAreaCount = areas.length;
                extLog(`🔍 [IBON] 共 ${areas.length} 個區塊，未售完 ${availableAreas.length} 個`);
            }
            let matchedAreas = [];
            for (let area of availableAreas) {
                let rawTitle  = area.getAttribute('title') || '';
                let areaTitle = normalizeText(rawTitle);
                let kwIndex   = -1;
                for (let i = 0; i < keywords.length; i++) {
                    if (matchKeyword(areaTitle, keywords[i])) {
                        kwIndex = i;
                        break;
                    }
                }
                if (kwIndex !== -1) {
                    let priceMatch  = rawTitle.match(/票價[：:]\s*(\d+)/);
                    let price       = priceMatch ? parseInt(priceMatch[1]) : 0;
                    let remainMatch = rawTitle.match(/尚餘[：:]\s*(\d+)/);
                    let remain      = remainMatch ? parseInt(remainMatch[1]) : 999;
                    if (remain > 0) {
                        matchedAreas.push({ area, price, remain, rawTitle, kwIndex });
                    }
                }
            }
            matchedAreas.sort((a, b) =>
                a.kwIndex - b.kwIndex ||
                b.price   - a.price   ||
                b.remain  - a.remain
            );
            if (matchedAreas.length > 0) {
                state.noHitLogShown = false;
                matchedAreas.forEach((item, i) => {
                    extLog(`🏷️ 候選第${i+1}名 [KW:${item.kwIndex} 票價:${item.price} 尚餘:${item.remain}]：${item.rawTitle.slice(0, 50)}`);
                });
                let best = matchedAreas[0];
                extLog(`🎯 [IBON] 命中目標！${best.rawTitle.slice(0, 60)}`);
                // ✅ 修正三：記錄點擊時間
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
                        extLog('🖱️ [IBON] 靜態地圖橋接失敗，嘗試 onTicketArea2');
                        try {
                            let areaId = best.area.getAttribute('id');
                            if (areaId) {
                                let tr = document.querySelector(`tr[rel="${areaId}"]`);
                                if (tr && typeof onTicketArea2 === 'function') {
                                    onTicketArea2(tr);
                                    extLog('✅ [IBON] onTicketArea2 呼叫成功');
                                } else {
                                    extLog('🖱️ [IBON] 無法找到 tr，改用 humanClick');
                                    await humanClick(best.area);
                                }
                            } else {
                                await humanClick(best.area);
                            }
                        } catch(e) {
                            extLog(`⚠️ [IBON] onTicketArea2 失敗：${e.message}，改用 humanClick`);
                            await humanClick(best.area);
                        }
                    }
                }
                return;
            }
            if (!state.noHitLogShown) {
                extLog('⚠️ [IBON] 關鍵字未命中任何未售完區域，繼續等待...');
                state.noHitLogShown = true;
            }
            // ✅ 修正四：改用時間判斷（15秒）取代次數判斷
            let elapsed = Date.now() - state.startTime;
            if (elapsed > 15000) {
                extLog(`⛔ [IBON] 已等待 ${Math.round(elapsed / 1000)} 秒未找到目標，觸發重整`);
                scanner.stop();
                await triggerAutoReload(autoReload);
            }
            return;
        }
        // ─────────────────────────────────────────────
        // STEP_SELECT_QTY
        // ─────────────────────────────────────────────
        if (step === 'STEP_SELECT_QTY') {
            if (state.qtyDone || dropdownValue === "none") return;
            let qtySelects = Array.from(
                document.querySelectorAll('select:not([disabled])')
            ).filter(isQuantitySelect);
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
        // STEP_CONFIRM
        // ─────────────────────────────────────────────
        if (step === 'STEP_CONFIRM') {
            extLog('🎉 [IBON] 已到達確認頁，停止掃描');
            scanner.stop();
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

function startAutoFill() {
    // ✅ 修正一：改用 platform 當 key，避免不同平台互相干擾
    let platform = detectPlatform();
    if (platform === 'UNKNOWN') return;

    let flagKey = `hasStartedAutoFill_${platform}`;
    if (window[flagKey]) return;
    window[flagKey] = true;

    chrome.storage.sync.get(
        ['autoCheck', 'autoReload', 'dropdownValue', 'autoClickZone', 'zoneKeywords'],
        function(data) {
            let settings = data || {};

            // ✅ 修正二：加上 log 確認觸發平台
            extLog(`🚀 [路由] 偵測到平台：${platform}`);

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

