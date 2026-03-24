document.addEventListener('DOMContentLoaded', function() {
    var autoCheckCheckbox = document.getElementById('autoCheck');
    var autoReloadCheckbox = document.getElementById('autoReload'); // 新增開關
    var dropdownSelect = document.getElementById('dropdownValue');
    var autoClickZoneCheckbox = document.getElementById('autoClickZone');
    var zoneKeywordsInput = document.getElementById('zoneKeywords');

    // 載入設定 (把 autoReload 也讀進來)
    chrome.storage.sync.get(['autoCheck', 'autoReload', 'dropdownValue', 'autoClickZone', 'zoneKeywords'], function(data) {
        if (data.autoCheck !== undefined) autoCheckCheckbox.checked = data.autoCheck;
        if (data.autoReload !== undefined) autoReloadCheckbox.checked = data.autoReload; // 載入狀態
        if (data.dropdownValue !== undefined) dropdownSelect.value = data.dropdownValue;
        if (data.autoClickZone !== undefined) autoClickZoneCheckbox.checked = data.autoClickZone;
        if (data.zoneKeywords !== undefined) zoneKeywordsInput.value = data.zoneKeywords;
    });

    // 儲存設定
    autoCheckCheckbox.addEventListener('change', function() {
        chrome.storage.sync.set({'autoCheck': autoCheckCheckbox.checked});
    });

    // 儲存重整開關狀態
    autoReloadCheckbox.addEventListener('change', function() {
        chrome.storage.sync.set({'autoReload': autoReloadCheckbox.checked});
    });

    dropdownSelect.addEventListener('change', function() {
        chrome.storage.sync.set({'dropdownValue': dropdownSelect.value});
    });

    autoClickZoneCheckbox.addEventListener('change', function() {
        chrome.storage.sync.set({'autoClickZone': autoClickZoneCheckbox.checked});
    });

    zoneKeywordsInput.addEventListener('input', function() {
        chrome.storage.sync.set({'zoneKeywords': zoneKeywordsInput.value});
    });
});
