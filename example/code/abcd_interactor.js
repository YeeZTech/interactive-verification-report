// 按 API 分函数来响应
function parseParams(params) {
    if (typeof params === 'string') {
        try { return JSON.parse(params); } catch { return { raw: params }; }
    }
    return params || {};
}

function safe(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function api_json(meta, storage, p) {
    return { meta, note: 'served by abcd_interactor (json)', params: p };
}

function api_html(meta, storage, p) {
    const title = p.title || '验证报告';
    const jsonPretty = safe(JSON.stringify(meta, null, 2));
    return `
        <section style="display:grid;gap:12px">
            <h2 style="margin:0">${safe(title)}</h2>
            <div style="color:#64748b">enclave_hash: ${safe(meta.enclave_hash || 'unknown')}</div>
            <div>
                <button id="ivr-show-json"
                    style="padding:6px 10px;border-radius:8px;border:1px solid #334155;background:#334155;color:#fff;cursor:pointer;"
                    onclick="(async function(){try{var h=(document.getElementById('hashInput')||{}).value||'';var params=encodeURIComponent(JSON.stringify({format:'json'}));var resp=await fetch('/api/report?request_hash='+encodeURIComponent(h)+'&params='+params);if(resp.status===304){var area0=document.getElementById('ivr-json-area');if(area0){area0.textContent='未更改(304)';}return;}var j=await resp.json();if(!resp.ok||!j.success)throw new Error((j&&j.error&&j.error.message)||'请求失败');var area=document.getElementById('ivr-json-area');if(area){area.textContent=JSON.stringify(j.result,null,2);}}catch(e){var area=document.getElementById('ivr-json-area');if(area){area.textContent='加载失败：'+String(e);}}})();"
                >显示原始 JSON</button>
            </div>
            <details open>
                <summary>元数据(JSON)</summary>
                <pre style="background:#0b1022;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto">${jsonPretty}</pre>
            </details>
            <div>
                <div style="color:#9aa4b2;margin-bottom:6px;">动态请求返回的 JSON：</div>
                <pre id="ivr-json-area" style="background:#0b1022;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto;min-height:48px">(点击上方按钮获取)</pre>
            </div>
        </section>
    `;
}

function route(meta, storage, p) {
    const action = (p.action || '').toLowerCase();
    const format = (p.format || '').toLowerCase();
    if (action === 'json' || format === 'json') return api_json(meta, storage, p);
    // 未来：这里可以扩展更多 API，如 action==='summary' 等
    return api_html(meta, storage, p);
}

module.exports = function(meta, storage, params) {
    const p = parseParams(params);
    return route(meta, storage, p);
};