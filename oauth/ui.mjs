export function loginPage(nonce) {
  return `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Codex 订阅 · Deep Literature for Codex</title>
<style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#172330;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:800px;margin:48px auto;padding:0 24px}a{color:#17605d}h1{font-size:30px;margin:8px 0}h2{font-size:20px;margin:0 0 12px}.card{background:white;border:1px solid #dde3e8;border-radius:12px;padding:24px;margin:20px 0}.muted{color:#576674}button,.button{font:inherit;border:1px solid #9fadb8;background:white;border-radius:7px;padding:8px 15px;cursor:pointer;color:#172330;text-decoration:none}button.primary{background:#17605d;border-color:#17605d;color:white}button:disabled{opacity:.45;cursor:default}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.badge{display:inline-block;border-radius:20px;padding:3px 12px;background:#edf2f5}#feedback{min-height:1.7em;color:#754b12}li{margin:10px 0}small{font-size:14px}
</style>
<main><a href="/">← 返回 Deep Literature for Codex</a><h1>Codex 订阅</h1>
<p class="muted">在本工作台内使用 ChatGPT / Codex 订阅。普通模型仍在 DSH 的模型设置中管理。</p>
<section class="card"><h2>登录状态</h2><span id="status" class="badge" role="status">正在读取状态…</span><p id="plan" class="muted"></p>
<div class="actions"><button id="login" class="primary" disabled>使用 ChatGPT 登录</button><button id="cancel" disabled>取消登录</button><button id="logout" disabled>退出登录</button><button id="refresh">刷新状态</button></div>
<p><a id="authorize" class="button" hidden target="_blank" rel="noopener noreferrer">打开 OpenAI 授权页</a></p><p id="feedback" role="status"></p>
<small class="muted">授权由 OpenAI 页面完成，凭据保存在本实例。登录不会自动切换模型或改为 API 计费。登录成功后，请返回 DSH 的模型选择器，手动选择 OpenAI Codex。</small></section>
<section class="card"><h2>账号额度</h2><p class="muted">同一账号额度在 Codex 各客户端间共享。本页显示服务实际返回的额度；未返回的值显示为不可用。</p><div id="usage">不可用：尚未登录。</div></section>
<section class="card"><h2>候选版本说明</h2><p class="muted">支持文本与 DSH 工具调用，并保留会话上下文。中断后如果某个工具没有保存结果，系统会请您先核实，不会盲目重复该操作。</p></section>
</main><script nonce="${nonce}">
const byId = id => document.getElementById(id);
let pending = false;
let busy = false;
async function api(suffix = '', method = 'GET') {
  const response = await fetch('/api/codex-oauth' + suffix, {method, cache: 'no-store', credentials: 'same-origin'});
  if (!response.ok) throw new Error('操作未完成，请重试或重新启动工作台。');
  return response.json();
}
function clearLink() { byId('authorize').hidden = true; byId('authorize').removeAttribute('href'); }
function quotaWindow(label, value) {
  if (!value) return label + '：不可用';
  let text = label + '：已用 ' + value.usedPercent + '%，剩余 ' + value.remainingPercent + '%';
  if (value.windowDurationMins !== null) text += '；窗口 ' + value.windowDurationMins + ' 分钟';
  if (value.resetsAt !== null) text += '；重置时间 ' + new Date(value.resetsAt * 1000).toLocaleString();
  return text;
}
async function refresh() {
  if (busy) return;
  try {
    const state = await api();
    pending = state.login && ['pending','starting'].includes(state.login.status);
    const labels = {authenticated:'已登录', unauthenticated:'未登录', unavailable:'状态暂不可用', unsupported_auth:'当前凭据方式不受支持'};
    byId('status').textContent = pending ? '等待您完成登录' : (labels[state.status] || '状态暂不可用');
    byId('plan').textContent = state.planType ? '订阅类型：' + state.planType : '';
    byId('login').disabled = pending || state.authenticated;
    byId('cancel').disabled = !pending;
    byId('logout').disabled = !state.authenticated;
    if (!pending) clearLink();
    if (state.login && state.login.status === 'failed') byId('feedback').textContent = '登录未完成，请重新发起登录。';
    if (!state.authenticated) { byId('usage').textContent = '不可用：尚未登录或状态暂不可用。'; return; }
    const usage = await api('/usage');
    byId('usage').replaceChildren();
    if (usage.status !== 'available') { byId('usage').textContent = '不可用：服务未返回额度，或查询暂未成功。'; return; }
    const list = document.createElement('ul');
    for (const bucket of usage.buckets) {
      const item = document.createElement('li');
      item.textContent = (bucket.name || bucket.id) + ' — ' + quotaWindow('主要窗口', bucket.primary) + '；' + quotaWindow('次要窗口', bucket.secondary);
      list.appendChild(item);
    }
    byId('usage').appendChild(list);
  } catch (error) { byId('status').textContent = '状态暂不可用'; byId('feedback').textContent = error.message; }
}
async function action(suffix) {
  if (busy) return;
  busy = true;
  byId('feedback').textContent = '';
  try {
    const result = await api(suffix, 'POST');
    if (suffix === '/login') {
      byId('authorize').href = result.authUrl;
      byId('authorize').hidden = false;
      byId('feedback').textContent = '点击“打开 OpenAI 授权页”完成登录，然后返回本页。';
    } else { clearLink(); }
  } catch (error) { byId('feedback').textContent = error.message; }
  finally { busy = false; await refresh(); }
}
byId('login').addEventListener('click', () => action('/login'));
byId('cancel').addEventListener('click', () => action('/cancel'));
byId('logout').addEventListener('click', () => action('/logout'));
byId('refresh').addEventListener('click', refresh);
setInterval(() => { if (pending) refresh(); }, 2000);
refresh();
</script></html>`
}
