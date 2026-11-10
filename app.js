import { dimensions, questions, archetypes, guidance, calculateResult } from './data.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const storageKey = 'love-notes:v1';
const testCountKey = 'closer-notes:test-count:v1';
let testCount = 0;
let state = { answers: Array(24).fill(null), index: 0, screen: 'home' };
let result;
let saveFailed = false;
let toastTimer;
let resultTransitionTimer;
let deliveryReadyAt = 0;
let galleryFilter = 'all';

function readTestCount() {
  try {
    const count = Number(localStorage.getItem(testCountKey));
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
  } catch { return testCount; }
}
testCount = readTestCount();
function recordGeneratedResult() {
  testCount = readTestCount() + 1;
  try { localStorage.setItem(testCountKey, String(testCount)); }
  catch { /* Keep the counter available in memory if storage is disabled. */ }
}

function cancelResultTransition() {
  clearTimeout(resultTransitionTimer);
  resultTransitionTimer = undefined;
}

const paths = {
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/>',
  chat: '<path d="M21 11a8.5 8.5 0 0 1-9 8H5l-4 3 1.7-6A7.5 7.5 0 0 1 3 5a9 9 0 0 1 18 6Z"/><path d="M7 10h10M7 14h6"/>',
  spark: '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  mail: '<rect x="2" y="5" width="20" height="15" rx="3"/><path d="m3 7 9 7 9-7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
};
function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.heart}</svg>`; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function completed() { return state.answers.filter(a => a !== null).length; }
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { if (!saveFailed) { saveFailed = true; toast('浏览器未能保存进度，请在当前页面完成测试。'); } }
}
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && Array.isArray(saved.answers) && saved.answers.length === 24 && saved.answers.every(a => a === null || Number.isInteger(a) && a >= 0 && a <= 3)) {
    state.answers = saved.answers;
    state.index = Math.max(0, Math.min(23, Number.isInteger(saved.index) ? saved.index : 0));
    state.needsGeneration = saved.needsGeneration === true;
  }
} catch { /* Storage may be disabled; the in-memory experience remains available. */ }

function header() {
  return `<header class="header"><div class="header-inner"><a href="#" class="brand" data-action="home" aria-label="亲密来信首页"><span class="brand-icon"><img class="brand-paw" src="./assets/cats/brand-paw.svg" width="44" height="54" alt="" aria-hidden="true"></span><span>亲密来信<span class="brand-en">CLOSER NOTES</span></span></a><nav aria-label="主导航"><button class="nav-link nav-home ${state.screen === 'home' ? 'active' : ''}" data-action="home">关系测试</button><button class="nav-link nav-gallery ${state.screen === 'gallery' ? 'active' : ''}" data-action="gallery">小猫图鉴</button><button class="nav-link nav-test-about" data-action="about" aria-label="关于这份测试"><span>关于这份测试</span>${icon('info')}</button><button class="nav-about" data-action="privacy" aria-label="隐私说明">${icon('lock')}</button></nav></div></header>`;
}
function footer() {
  return `<footer class="footer"><span>CLOSER NOTES <span class="footer-dot">·</span> 让在乎多一点理解</span><span>每一种靠近，都有自己的方式 <span class="tiny-heart">♡</span></span></footer>`;
}
function authorNote() {
  return '<div class="author-note"><p>作者@Yoe1（小红书）</p><p>本测试不分性别，自己代入就好</p></div>';
}
function supportNote() {
  return `<section class="support-note" aria-labelledby="support-heading"><span class="support-heart" aria-hidden="true">♡</span><h2 id="support-heading">谢谢你，喜欢这份小小的来信</h2><p>如果这份小测试帮你多了解了自己一点，<br>欢迎各位宝宝随心打赏。谢谢你的喜欢与支持 ♡</p><a class="support-code-link" href="./assets/support/appreciation-code.jpg" target="_blank" rel="noopener" aria-label="查看完整赞赏码图片（新窗口）"><img class="support-code" src="./assets/support/appreciation-code.jpg" width="1152" height="1152" alt="作者提供的微信赞赏码，可扫码随心打赏" loading="lazy" decoding="async"></a><p class="support-hint">可v0.01备注许愿下期作品</p></section>`;
}
const catScenes = [
  { file: 'scene-01.png', alt: '两只小猫靠在一起', caption: '一点一点，靠近你' },
  { file: 'scene-02.png', alt: '白灰小猫给灰猫递信', caption: '喜欢，想让你知道' },
  { file: 'scene-03.png', alt: '两只小猫认真交流', caption: '我在听，你慢慢说' },
  { file: 'scene-04.png', alt: '两只小猫各自安静地看书', caption: '各自待着，也很安心' },
  { file: 'scene-05.png', alt: '灰猫轻轻安慰白灰小猫', caption: '委屈，也可以告诉我' },
  { file: 'scene-06.png', alt: '两只小猫相依着睡觉', caption: '在你身边，安心做自己' },
  { file: 'result-hug-pose.png', alt: '白灰小猫伸爪环抱灰猫，背对着我们的灰猫回抱着它', caption: '把理解，变成一个拥抱' },
  { file: 'ending-play-happy.png', alt: '白猫开心地张嘴笑，灰猫眯眼笑着一起玩毛线球', caption: '一起玩耍，一起开心' },
  { file: 'guide-care-dry.png', alt: '白灰小猫拿着信向灰猫表达关心', caption: '把在乎说给你听' },
  { file: 'guide-talk-dry.png', alt: '两只小猫平静地交流', caption: '我在听，你慢慢说' },
  { file: 'guide-rest-dry.png', alt: '两只小猫安心地依偎休息', caption: '在你身边，安心做自己' },
  { file: 'reflection-gray-dry.png', alt: '灰猫微笑着轻轻安慰流泪的白灰小猫', caption: '委屈，也可以告诉我' },
];
function catArt(scene, cls = '', decorative = false) {
  const cat = catScenes[scene];
  return `<img class="cat-art ${cls}" src="./assets/cats/${cat.file}" width="420" height="420" alt="${decorative ? '' : cat.alt}" ${decorative ? 'aria-hidden="true"' : ''} decoding="async">`;
}
function guideScene(r, dimension) {
  return dimension === 0 && !r.balanced[0] && r.sides[0] ? 3 : [0, 8, 9, 10][dimension];
}
function heroCats() {
  return `<div class="hero-cat-scene"><img class="hero-cats" src="./assets/cats/hero-tear-base.png" width="824" height="693" alt="白灰小猫的泪滴轻轻滑落，灰猫陪在身边，一起捧着来信" fetchpriority="high"><svg class="hero-tears" viewBox="0 0 824 693" fill="none" aria-hidden="true"><g class="hero-tear hero-tear-left"><path d="M165 301C160 306 147 306 145 316C141 328 154 334 165 331C178 329 184 319 176 311C172 307 168 305 165 301Z"/></g><g class="hero-tear hero-tear-right"><path d="M380 272C375 278 364 280 363 290C362 301 373 305 383 302C395 300 401 289 393 281C388 276 384 275 380 272Z"/></g></svg></div>`;
}
function home() {
  cancelResultTransition();
  history.replaceState(null, '', location.pathname + location.search);
  state.screen = 'home';
  const count = completed();
  app.innerHTML = `${header()}<main class="home-main"><section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="eyebrow-line"></span> 一段更懂彼此的关系，从这里开始</div><h1>我的亲密关系<br><span>使用说明书</span><svg class="heading-spark" viewBox="0 0 36 36" aria-hidden="true"><path d="m18 2 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></h1><p class="relationship-scope">伴侣、挚友，都可以是我们在乎的人。</p><p class="hero-description">有人把在乎说给你听，有人把关心藏在小事里。<br>了解自己的相处方式，也让重要的人更懂你。</p><div class="hero-cta"><button class="button primary start-button" data-action="start">${count === 24 ? '查看我的说明书' : count ? '继续我的测试' : '开启我的关系探索'}${icon('arrow')}</button><span class="time-label">${icon('clock')} 约 3–5 分钟</span></div><div class="hero-notes"><span>${icon('check')}24 道生活情境题</span><span>${icon('check')}16 种关系画像</span><span>${icon('check')}专属相处指南</span></div>${count && count < 24 ? `<div class="saved-note">已为你保留 ${count}/24 题的进度 <button data-action="restart">重新开始</button></div>` : ''}</div><div class="hero-visual"><span class="art-caption top-caption">TWO LITTLE CATS, A LITTLE CLOSER</span>${heroCats()}<div class="floating-note"><span class="floating-dot"></span> 每一份在乎，都值得被读懂 <span>♡</span></div><span class="art-caption bottom-caption">a little clumsy, a little closer</span></div></section><section class="dimensions-section" aria-labelledby="dimension-heading"><div class="section-intro"><span class="section-kicker">A LITTLE CLOSER TO YOU</span><h2 id="dimension-heading">从四个维度，读懂你的亲密关系</h2><p>没有标准答案，只有更适合你的相处方式</p></div><div class="dimension-grid">${dimensions.map((d, i) => `<article class="dimension-card dimension-${i}">${catArt([0, 8, 9, 10][i], 'dimension-cat', true)}<h3>${d.name}</h3><p>${d.hint}</p><div class="polarity"><span>${d.left}</span><span class="polarity-line"></span><span>${d.right}</span></div></article>`).join('')}</div></section>${homeGalleryPreview()}<section class="home-bottom"><div class="gentle-note">${catArt(10, 'gentle-cats', true)}<p>从在乎的关系出发，温柔地认识自己。<br><span>愿这份说明书，成为你们好好说话的开始。</span></p></div><button class="text-button" data-action="preview">先看看说明书的样子 ${icon('arrow')}</button></section>${authorNote()}</main>${footer()}`;
}
function homeGalleryPreview() {
  return `<section class="home-gallery" aria-labelledby="home-gallery-title"><div class="home-gallery-copy"><span class="section-kicker">MEET YOUR LITTLE CAT</span><h2 id="home-gallery-title">16 只小猫，哪一只像你？</h2><p>是喜欢贴贴的窝窝猫，还是慢慢靠近的慢慢猫？<br>翻开图鉴，认识每一种在乎的方式。</p><button class="text-button" data-action="gallery">翻开小猫关系图鉴 ${icon('arrow')}</button></div><div class="home-gallery-samples">${[0, 4, 10].map(type => `<button class="home-cat-card" data-action="catalog-preview" data-type="${type}" aria-label="查看${archetypes[type][0]}的说明书">${galleryArt(type, 'home-catalog-cat')}<span>${archetypes[type][0]}</span><small>NO. ${String(type + 1).padStart(2, '0')}</small></button>`).join('')}</div></section>`;
}
function archetypeResult(type) {
  const sides = [3, 2, 1, 0].map(shift => type >> shift & 1);
  return calculateResult(questions.map(q => q.direction === 1 ? sides[q.dimension] * 3 : (1 - sides[q.dimension]) * 3));
}
const galleryArtDescriptions = [
  '白灰小猫为灰猫倒茶，两只猫坐在软垫上分享暖茶',
  '白灰小猫吹泡泡，灰猫开心跳起来追泡泡',
  '白灰小猫写信，灰猫在旁边准备爱心信封',
  '两只小猫依偎在月亮形软垫上安静休息',
  '两只小猫一起搭起毯子小窝，整理里面的坐垫',
  '两只小猫一起收拾装着面包和苹果的野餐篮',
  '两只小猫把橡果和叶片收藏进小盒子',
  '两只小猫围着同一条粉色围巾，贴着脸拥抱',
  '两只小猫用纸杯传声筒，一只说话一只认真听',
  '两只小猫一起奔跑，放起粉色的小风筝',
  '灰猫在小灯旁等待，白灰小猫藏着花慢慢走近',
  '两只小猫一起用小望远镜观察星星',
  '两只小猫穿着围裙，一起煮一锅热汤',
  '两只小猫背上小背包，拿着地图一起去探险',
  '两只小猫一起照顾花盆，浇水守护开花的小苗',
  '两只小猫趴在各自的云朵软垫上，一起看纸飞机飞过',
];
function portraitImageSource(type) {
  return `./assets/cats/gallery/cat-${String(type + 1).padStart(2, '0')}.png`;
}
function galleryArt(type, cls = '') {
  return `<img class="cat-art ${cls}" src="${portraitImageSource(type)}" width="420" height="420" alt="${galleryArtDescriptions[type]}" decoding="async">`;
}
const galleryMotifs = ['heart', 'spark', 'mail', 'orbit', 'heart', 'spark', 'mail', 'heart', 'chat', 'orbit', 'clock', 'spark', 'check', 'orbit', 'clock', 'mail'];
function gallery(filter = galleryFilter, moveFocus = false) {
  cancelResultTransition();
  galleryFilter = ['all', 'together', 'space'].includes(filter) ? filter : 'all';
  state.screen = 'gallery';
  history.replaceState(null, '', location.pathname + location.search + '#cats');
  const ownType = completed() === 24 && !state.needsGeneration ? calculateResult(state.answers).type : null;
  const entries = archetypes.map(([name, subtitle], type) => ({ name, subtitle, type, sides: archetypeResult(type).sides }))
    .filter(cat => galleryFilter === 'all' || cat.sides[0] === (galleryFilter === 'space' ? 1 : 0));
  app.innerHTML = `${header()}<main class="gallery-main"><section class="gallery-intro" aria-labelledby="gallery-title"><div class="gallery-intro-copy"><span class="section-kicker">THE LITTLE CAT COMPANION</span><h1 id="gallery-title" tabindex="-1">小猫关系图鉴<span>16 种小猫，16 种在乎的方式</span></h1><p>有的小猫喜欢贴贴，有的小猫需要自己的小角落。<br>每一种相处方式，都值得被温柔读懂。</p><button class="button primary" data-action="start">${ownType === null ? '找到我的小猫' : '查看我的小猫说明书'}${icon('arrow')}</button></div><div class="gallery-cover" aria-hidden="true"><span class="gallery-cover-label">CLOSER NOTES · VOL. 01</span>${catArt(7, 'gallery-cover-cats', true)}<span class="gallery-cover-caption">每只小猫，都有自己的靠近方式 ♡</span></div></section><section class="gallery-collection" aria-label="16种小猫画像"><div class="gallery-toolbar"><div class="gallery-filters" role="group" aria-label="按靠近的节奏筛选">${[['all', '全部小猫'], ['together', '喜欢常常在一起'], ['space', '喜欢自在地靠近']].map(([value, label]) => `<button data-action="gallery-filter" data-filter="${value}" aria-pressed="${galleryFilter === value}">${label}</button>`).join('')}</div><p class="gallery-count" aria-live="polite">共 ${entries.length} 只小猫</p></div><div class="gallery-grid">${entries.map(cat => `<article class="catalog-card catalog-tone-${Math.floor(cat.type / 4)}"><div class="catalog-card-top"><span class="catalog-number">NO. ${String(cat.type + 1).padStart(2, '0')}</span>${ownType === cat.type ? '<span class="catalog-own">你的小猫</span>' : icon(galleryMotifs[cat.type])}</div><div class="catalog-illustration">${galleryArt(cat.type, 'catalog-cats')}</div><h2>${cat.name}</h2><p class="catalog-description">${cat.subtitle}</p><ul class="catalog-traits" aria-label="四个相处偏好">${dimensions.map((d, i) => `<li>${cat.sides[i] ? d.right : d.left}</li>`).join('')}</ul><button class="catalog-open" data-action="catalog-preview" data-type="${cat.type}" aria-label="查看${cat.name}的说明书">翻开这只小猫的来信 ${icon('arrow')}</button></article>`).join('')}</div><p class="gallery-note">图鉴展示四种偏好的 16 种组合。真实的你也可能兼有两种偏好，或随着关系和状态慢慢变化。</p></section><section class="gallery-ending"><img src="./assets/cats/brand-paw.svg" width="36" height="44" alt="" aria-hidden="true"><h2>你会是哪一只小猫？</h2><p>跟着直觉回答 24 道小题，收下一封写给自己的来信。</p><button class="button primary" data-action="start">${completed() ? '继续我的关系探索' : '开启我的关系探索'}${icon('arrow')}</button><button class="text-button" data-action="home">返回首页</button></section></main>${footer()}`;
  if (moveFocus) document.querySelector(`[data-filter="${galleryFilter}"]`).focus({ preventScroll: true });
  else window.scrollTo({ top: 0 });
}
function start() {
  history.replaceState(null, '', location.pathname + location.search);
  if (completed() === 24) { showResult(false, state.needsGeneration === true); return; }
  if (state.answers[state.index] !== null) { const next = state.answers.indexOf(null); if (next >= 0) state.index = next; }
  state.screen = 'quiz'; persist(); quiz(); window.scrollTo({ top: 0 });
}
function quiz(moveFocus = false) {
  cancelResultTransition();
  const previousProgress = document.querySelector('.quiz-progress');
  state.screen = 'quiz';
  const q = questions[state.index];
  const d = dimensions[q.dimension];
  app.innerHTML = `${header()}<main class="quiz-main"><div class="quiz-topline"><button class="text-button" data-action="home">${icon('back')} 返回首页</button><span>${icon('lock')} ${saveFailed ? '当前进度仅保留在此页面' : '进度已自动保存在此浏览器'}</span></div>${journeyMarkup()}<section class="question-panel"><div class="question-heading"><div><span class="question-category">${icon(d.icon)}${d.name}</span><span class="question-number">第 ${state.index + 1} / 24 题</span><h1 id="question-title" tabindex="-1">${q.title}</h1></div></div><p class="question-hint">选择更接近你真实感受的一项，跟着第一直觉就好。</p><div class="options" role="radiogroup" aria-labelledby="question-title">${q.options.map((o, i) => `<button class="option ${state.answers[state.index] === i ? 'selected' : ''}" role="radio" aria-checked="${state.answers[state.index] === i}" data-answer="${i}"><span class="option-letter">${'ABCD'[i]}</span><span>${o}</span><span class="option-check">${icon('check')}</span></button>`).join('')}</div><div class="quiz-controls"><button class="text-button previous" data-action="previous" ${state.index === 0 ? 'disabled' : ''}>${icon('back')} 上一题</button><span>你的感受，没有对错</span><button class="button primary next" data-action="next" ${state.answers[state.index] === null ? 'disabled' : ''}>${state.index === 23 ? '生成我的说明书' : '下一题'}${icon('arrow')}</button></div></section><p class="quiz-footnote">${icon('heart')} 请根据平时的自己作答，无需选择「理想中的答案」。</p></main>${footer()}`;
  // Keep the moving cats mounted when the question changes, including rapid clicks.
  if (previousProgress) document.querySelector('.quiz-progress').replaceWith(previousProgress);
  updateJourney();
  if (moveFocus) document.querySelector('#question-title').focus({ preventScroll: true });
}

function journeySenderAsset() {
  return `./assets/cats/${state.index === 0 ? 'progress-pickup' : 'progress-sender'}.png`;
}
function journeyMarkup() {
  const count = completed();
  return `<div class="quiz-progress${count === 24 ? ' is-delivered' : ''}" data-completed="${count}" style="--journey:${count / 24 * 100}%"><div class="progress-meta"><span>捡到你的信，才懂你的委屈</span><span class="progress-count">已完成 <strong>${String(count).padStart(2, '0')}</strong> / 24</span></div><div class="cat-journey"><div class="progress-track" role="progressbar" aria-label="小猫读信后靠近的进度" aria-valuemin="0" aria-valuemax="24" aria-valuenow="${count}"><div style="width:${count / 24 * 100}%"></div><div class="journey-steps" aria-hidden="true">${Array.from({ length: 25 }, (_, i) => `<i style="left:${i / 24 * 100}%"></i>`).join('')}</div></div><div class="journey-route" aria-hidden="true"><div class="journey-sender"><img class="journey-cat" src="${journeySenderAsset()}" width="280" height="320" alt=""><span class="journey-shadow"></span></div></div><div class="journey-receiver" aria-hidden="true"><img class="journey-cat" src="./assets/cats/progress-receiver.png" width="280" height="320" alt=""><span class="journey-heart">♡</span><span class="journey-shadow"></span></div></div><div class="journey-note"><span class="journey-status" role="status" aria-live="polite" aria-atomic="true">${journeyMessage(count)}</span><span class="journey-end-label">等一个懂我的拥抱</span></div><div class="progress-dots">${dimensions.map((dim, i) => `<span data-dimension="${i}">${icon(dim.icon)}${dim.name}</span>`).join('')}</div></div>`;
}
function journeyMessage(count) {
  return count === 24 ? '读懂了你的委屈，想给你一个拥抱 ♡' : count === 0 ? '原来你受委屈了，我这就走向你' : `多懂你一点，就靠近一步 · 还差 ${24 - count} 步`;
}
function updateJourney(advance = false) {
  const progress = document.querySelector('.quiz-progress');
  if (!progress) return;
  const count = completed();
  progress.dataset.completed = count;
  const senderImage = progress.querySelector('.journey-sender .journey-cat');
  if (senderImage.getAttribute('src') !== journeySenderAsset()) senderImage.src = journeySenderAsset();
  progress.style.setProperty('--journey', `${count / 24 * 100}%`);
  progress.querySelector('.progress-track > div').style.width = `${count / 24 * 100}%`;
  progress.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', count);
  progress.querySelector('[role="progressbar"]').setAttribute('aria-valuetext', `已完成 ${count} 题，共 24 题${count === 24 ? '，小猫已读懂来信，走到了对方身边' : ''}`);
  progress.querySelector('.progress-count strong').textContent = String(count).padStart(2, '0');
  progress.querySelector('.journey-status').textContent = journeyMessage(count);
  progress.querySelector('.journey-end-label').textContent = count === 24 ? '等到了你的拥抱' : '等一个懂我的拥抱';
  progress.querySelectorAll('[data-dimension]').forEach(el => el.classList.toggle('current', Number(el.dataset.dimension) === questions[state.index].dimension));
  progress.classList.toggle('is-delivered', count === 24);
  if (advance) {
    const sender = progress.querySelector('.journey-sender .journey-cat');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sender.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-5px) rotate(-4deg)', offset: .45 }, { transform: 'translateY(0) rotate(0)' }], { duration: 480, easing: 'ease-in-out' });
    }
    if (count === 24) {
      progress.classList.add('is-arriving');
      deliveryReadyAt = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1400);
    }
  }
}
function finishQuiz() {
  if (resultTransitionTimer !== undefined) return;
  const wait = Math.max(0, deliveryReadyAt - performance.now());
  if (!wait) { showResult(false, true); return; }
  const button = document.querySelector('[data-action="next"]');
  button.disabled = true;
  button.textContent = '小猫正走向你…';
  resultTransitionTimer = setTimeout(() => {
    resultTransitionTimer = undefined;
    if (state.screen === 'quiz' && completed() === 24) showResult(false, true);
  }, wait);
}
function selectedGuidance(r, i) {
  if (!r.balanced[i]) return guidance[i][r.sides[i]];
  const d = dimensions[i];
  return {
    title: `${d.name}：你兼有两种偏好`,
    body: `在这一维度，你的选择接近中间。你可能根据对象、情境和当下状态，在「${d.left}」与「${d.right}」之间调整。`,
    request: `在${d.name}这件事上，我的需要会随状态变化。我们可以说说今天各自更需要什么。`,
    practice: `留意自己在什么情境下偏向「${d.left}」，什么时候更需要「${d.right}」，并主动告诉对方。`,
    misunderstanding: `你的偏好可能随情境变化，表达当下的需要，比期待对方沿用上一次的经验更有效。`,
  };
}
const preferenceSummaries = [
  ['分享日常、常常联系，会让你感到亲近。', '留出自己的时间，再相聚会更自在。'],
  ['把在乎说清楚，更容易让你感到被珍惜。', '记住小习惯、认真做小事，更能打动你。'],
  ['有了分歧，你更愿意尽早把心里话聊开。', '先整理情绪和想法，你会更容易开口。'],
  ['提前商量好安排，会让你更安心。', '留一点即兴和弹性，会让你更放松。'],
];
function relationshipOverview(r) {
  return `<section class="result-overview" aria-labelledby="preference-heading"><div class="result-section-title"><span>01</span><h2 id="preference-heading">我的相处偏好</h2><p>看看哪种方式，让你更自在</p></div><div class="preference-grid">${dimensions.map((d, i) => {
    const right = r.scores[i];
    const left = 100 - right;
    const balanced = r.balanced[i];
    const side = r.sides[i];
    const label = balanced ? '两种方式都适合' : `更偏向「${side ? d.right : d.left}」`;
    return `<article class="preference-card preference-${i}${balanced ? ' is-balanced' : ''}"><div class="preference-heading">${icon(d.icon)}<h3>${d.name}</h3><span class="preference-state">${balanced ? '随情境切换' : '本次偏好'}</span></div><h4 class="preference-conclusion">${label}</h4><p class="preference-explanation">${balanced ? `你会根据对象和当下状态，在${d.left}与${d.right}之间调整。` : preferenceSummaries[i][side]}</p><div class="preference-comparison"><div class="preference-labels"><span class="${!balanced && !side ? 'is-preferred' : ''}">${d.left}<strong>${left}<small>%</small></strong></span><span class="${!balanced && side ? 'is-preferred' : ''}"><strong>${right}<small>%</small></strong>${d.right}</span></div><div class="preference-bar" role="img" aria-label="${d.name}：${d.left} ${left}%，${d.right} ${right}%。${label}"><span class="preference-fill preference-left" style="flex-grow:${left}"${left === 0 ? ' hidden' : ''}></span><span class="preference-fill preference-right" style="flex-grow:${right}"${right === 0 ? ' hidden' : ''}></span></div></div></article>`;
  }).join('')}</div><p class="result-disclaimer">占比由本次回答换算，表示两种偏好的相对倾向，不是能力评分。两边接近时，表示你兼有两种偏好；具体需要也可能随情境变化。</p></section>`;
}
function showResult(sample = false, generated = false, galleryType = null) {
  cancelResultTransition();
  const fromGallery = sample && Number.isInteger(galleryType) && galleryType >= 0 && galleryType < 16;
  result = fromGallery ? archetypeResult(galleryType) : sample ? calculateResult(questions.map(q => q.direction === 1 ? [3, 0, 3, 0][q.dimension] : [0, 3, 0, 3][q.dimension])) : calculateResult(state.answers);
  history.replaceState(null, '', location.pathname + location.search + (fromGallery ? `#cat-${galleryType + 1}` : ''));
  if (!sample && generated) { recordGeneratedResult(); state.needsGeneration = false; }
  else testCount = readTestCount();
  state.screen = sample ? 'sample' : 'result';
  if (!sample) persist();
  const r = result;
  const notes = dimensions.map((_, i) => selectedGuidance(r, i));
  app.innerHTML = `${header()}<main class="result-main">${sample ? '<div class="sample-banner">这是一份示例说明书。完成测试后，会生成属于你的内容。<button data-action="start">开始我的测试 →</button></div>' : ''}<div class="result-intro"><span class="section-kicker">A LITTLE GUIDE TO KNOWING ME</span><p>${sample ? '示例' : '你的专属'}亲密关系使用说明书</p><div class="result-emblem">${galleryArt(r.type, 'result-cats')}</div><h1>${r.name}</h1><p class="result-subtitle">${r.subtitle}</p><span class="result-number">RELATIONSHIP PORTRAIT · ${String(r.type + 1).padStart(2, '0')} / 16</span><button class="text-button result-gallery-link" data-action="gallery-return">${icon('back')} ${fromGallery ? '返回小猫图鉴' : '认识全部16只小猫'}</button></div>${relationshipOverview(r)}<section class="result-guides"><div class="result-section-title"><span>02</span><h2>关于我的四件小事</h2></div><div class="guide-grid">${notes.map((n, i) => `<article class="guide-card dimension-${i}">${catArt(guideScene(r, i), 'guide-cat', true)}<span class="guide-label">${dimensions[i].name}</span><h3>${n.title}</h3><p>${n.body}</p><blockquote>“${n.request}”</blockquote></article>`).join('')}</div></section><section class="result-reflections"><div class="reflection-column"><span class="section-kicker">A LITTLE UNDERSTANDING</span><h2>那些容易发生的误会</h2>${catArt(11, 'reflection-cats', true)}${notes.slice(0, 3).map(n => `<p>${icon('chat')}<span>${n.misunderstanding}</span></p>`).join('')}</div><div class="reflection-column practice-column"><span class="section-kicker">A LITTLE PRACTICE</span><h2>我也可以练习的事</h2>${notes.map(n => `<p>${icon('spark')}<span>${n.practice}</span></p>`).join('')}</div></section><section class="share-section"><div><span class="section-kicker">A NOTE WORTH SHARING</span><h2>把这一页，送给想懂你的人</h2><p>分享卡片只包含关系画像和相处提示。<br>你可以先编辑文字，再决定分享给谁。</p><div class="share-actions"><button class="button primary" data-action="share">${icon('download')} 制作我的分享卡片</button><button class="button secondary" data-action="copy">${icon('copy')} 复制相处提示</button></div><p class="test-count" aria-live="polite">已测试小咪：<strong>${testCount.toLocaleString('zh-CN')}</strong> 只</p></div><div class="mini-share"><span>CLOSER NOTES / 我的相处说明书</span>${galleryArt(r.type, 'mini-share-cats')}<h3>${r.name}</h3><p>${r.subtitle}</p><div class="mini-tags">${dimensions.map((d, i) => `<span>${r.balanced[i] ? '灵活平衡' : r.sides[i] ? d.right : d.left}</span>`).join('')}</div><span class="mini-bottom">每一份在乎，都值得被读懂 ♡</span></div></section><div class="result-ending">${catArt(7, 'ending-cats')}<p>人会成长，关系也会变化。<br>把这份说明书当作一次对话的开始，让彼此继续认识彼此。</p><div><button class="text-button" data-action="edit">${sample ? '开始我的测试' : '修改我的答案'} ${icon('arrow')}</button>${!sample ? '<button class="text-button muted" data-action="restart">重新测试</button>' : ''}</div><p class="disclaimer">本测试为原创自我探索工具，未经心理测量学验证，不用于心理诊断或关系匹配预测。</p></div>${authorNote()}${supportNote()}</main>${footer()}`;
  if (fromGallery) document.querySelector('.sample-banner').innerHTML = `你正在阅读「${r.name}」的图鉴示例。你的专属偏好以实际答题为准。<button data-action="gallery-return">返回小猫图鉴</button>`;
  window.scrollTo({ top: 0 });
}
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500); }
function openModal(title, body, cls = '') {
  modal.className = cls;
  modal.innerHTML = `<div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div>${body}`;
  modal.showModal();
}
function openShare() {
  const r = result;
  openModal('一张写给重要的人的卡片', `<p class="modal-lead">给它加一点你的语气。下载前可以自由修改。</p><div class="share-modal-cats">${galleryArt(r.type)}</div><form id="share-form"><label>称呼（选填）<input id="share-name" maxlength="14" placeholder="例如：小林" autocomplete="off"></label><label>我希望你知道<textarea id="share-message" rows="4" maxlength="160">${esc(dimensions.map((_, i) => selectedGuidance(r, i).request).slice(0, 3).join('\n').slice(0, 160))}</textarea></label><p class="share-privacy">卡片包含称呼、关系画像和以上文字，不包含你的逐题答案。</p><button class="button primary" type="submit">${icon('download')} 下载 PNG 卡片</button></form>`, 'share-modal');
}
function drawWrapped(ctx, text, x, y, width, lineHeight) {
  let line = '';
  for (const char of text) {
    if (char === '\n') { ctx.fillText(line, x, y); y += lineHeight; line = ''; continue; }
    if (ctx.measureText(line + char).width > width && line) { ctx.fillText(line, x, y); line = char; y += lineHeight; }
    else line += char;
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}
async function downloadCard(name, message) {
  const button = document.querySelector('#share-form button[type="submit"]');
  if (button?.disabled) return;
  if (button) { button.disabled = true; button.textContent = '正在绘制双猫卡片…'; }
  const cardResult = result;
  try {
    const illustration = new Image();
    illustration.src = portraitImageSource(cardResult.type);
    await illustration.decode();
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#faf7f3'; ctx.fillRect(0, 0, 900, 1500);
    ctx.fillStyle = '#eee6f1'; ctx.beginPath(); ctx.arc(770, 70, 210, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a18aab'; ctx.font = '18px Georgia'; ctx.fillText('CLOSER NOTES  /  A LITTLE GUIDE TO KNOWING ME', 75, 103);
    ctx.fillStyle = '#8b798c'; ctx.font = '23px "Microsoft YaHei", sans-serif';
    drawWrapped(ctx, name ? `${name}的亲密关系使用说明书` : '我的亲密关系使用说明书', 75, 160, 750, 35);
    ctx.drawImage(illustration, 275, 190, 350, 350);
    ctx.textAlign = 'center'; ctx.fillStyle = '#655366'; ctx.font = 'bold 43px "Microsoft YaHei", sans-serif';
    let y = drawWrapped(ctx, cardResult.name, 450, 570, 750, 58);
    ctx.textAlign = 'left'; ctx.fillStyle = '#9b869e'; ctx.font = '24px "Microsoft YaHei", sans-serif';
    y = drawWrapped(ctx, cardResult.subtitle, 75, y + 8, 750, 41);
    ctx.strokeStyle = '#e3d8e6'; ctx.beginPath(); ctx.moveTo(75, y + 15); ctx.lineTo(825, y + 15); ctx.stroke();
    ctx.fillStyle = '#9b80aa'; ctx.font = '20px "Microsoft YaHei", sans-serif'; ctx.fillText('与我相处，你可以知道这些', 75, y + 68);
    const content = message.trim() || '愿我们坦诚表达，也认真倾听。';
    const messageTop = y + 128;
    // Measure before painting so even newline-heavy messages cannot overlap the footer.
    let fontSize = 27, lineHeight = 45;
    function contentHeight() {
      let lines = 1, line = '';
      for (const char of content) {
        if (char === '\n') { lines++; line = ''; }
        else if (ctx.measureText(line + char).width > 750 && line) { lines++; line = char; }
        else line += char;
      }
      return lines * lineHeight;
    }
    ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
    while (contentHeight() > 1330 - messageTop && fontSize > 10) {
      fontSize--; lineHeight = Math.ceil(fontSize * 1.65);
      ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
    }
    const requiredHeight = Math.max(1500, Math.ceil(messageTop + contentHeight() + 150));
    if (requiredHeight > canvas.height) {
      const saved = document.createElement('canvas'); saved.width = canvas.width; saved.height = canvas.height;
      saved.getContext('2d').drawImage(canvas, 0, 0);
      canvas.height = requiredHeight;
      ctx.fillStyle = '#faf7f3'; ctx.fillRect(0, 0, 900, requiredHeight); ctx.drawImage(saved, 0, 0);
    }
    ctx.fillStyle = '#796778'; ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
    drawWrapped(ctx, content, 75, messageTop, 750, lineHeight);
    const bottom = canvas.height;
    ctx.strokeStyle = '#dfd2df'; ctx.lineWidth = 2; ctx.strokeRect(35, 35, 830, bottom - 70);
    ctx.fillStyle = '#a08ba5'; ctx.font = '19px "Microsoft YaHei", sans-serif'; ctx.fillText('每一种靠近，都有自己的方式。', 75, bottom - 105);
    ctx.font = '15px "Microsoft YaHei", sans-serif'; ctx.fillText('原创自我探索 · 关系偏好会随情境与成长变化', 75, bottom - 65);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Canvas export failed');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = '亲密来信-双猫相处说明书.png'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('双猫卡片已生成，请查看浏览器下载。'); modal.close();
  } catch {
    toast('卡片暂时未能生成，请稍后重试。');
  } finally {
    if (button) { button.disabled = false; button.innerHTML = `${icon('download')} 下载 PNG 卡片`; }
  }
}
async function copyNotes() {
  const text = `我的亲密关系使用说明书｜${result.name}\n${result.subtitle}\n\n${dimensions.map((_, i) => selectedGuidance(result, i).request).join('\n')}\n\n这只是此刻的偏好，愿我们继续认识彼此。`;
  try { await navigator.clipboard.writeText(text); toast('相处提示已复制，可以发给想懂你的人。'); }
  catch { openModal('复制你的相处提示', `<p class="modal-lead">请长按或选中下方文字复制。</p><textarea class="copy-fallback" rows="12" readonly>${esc(text)}</textarea>`); }
}

document.addEventListener('click', event => {
  const answer = event.target.closest('[data-answer]');
  if (answer && state.screen === 'quiz') {
    if (resultTransitionTimer !== undefined) return;
    const isNewAnswer = state.answers[state.index] === null;
    const choice = Number(answer.dataset.answer);
    if (state.answers[state.index] !== choice) state.needsGeneration = true;
    state.answers[state.index] = choice; persist();
    document.querySelectorAll('[data-answer]').forEach(el => {
      const selected = el.dataset.answer === answer.dataset.answer;
      el.classList.toggle('selected', selected); el.setAttribute('aria-checked', selected);
    });
    document.querySelector('[data-action="next"]').disabled = false;
    updateJourney(isNewAnswer);
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  event.preventDefault();
  switch (button.dataset.action) {
    case 'home': home(); window.scrollTo({ top: 0 }); break;
    case 'start': start(); break;
    case 'next':
      if (state.answers[state.index] === null) return;
      if (state.index < 23) { state.index++; persist(); quiz(true); }
      else if (completed() === 24) { finishQuiz(); }
      else { state.index = state.answers.indexOf(null); persist(); quiz(true); }
      break;
    case 'previous': if (state.index > 0) { state.index--; persist(); quiz(true); } break;
    case 'edit': if (state.screen === 'sample') start(); else { state.index = 0; quiz(true); } break;
    case 'preview': showResult(true); break;
    case 'gallery': gallery('all'); break;
    case 'gallery-return': gallery(); break;
    case 'gallery-filter': gallery(button.dataset.filter, true); break;
    case 'catalog-preview': {
      const type = Number(button.dataset.type);
      if (Number.isInteger(type) && type >= 0 && type < 16) showResult(true, false, type);
      break;
    }
    case 'close': modal.close(); break;
    case 'about': openModal('一封让彼此更懂的来信', '<div class="modal-copy"><p>亲密来信通过 24 道生活情境题，探索靠近节奏、关心表达、分歧处理和相处安排四个维度。每个维度包含 6 道题，结合回答生成 16 种关系画像之一。</p><p>亲密也包括好朋友之间的信任与陪伴。答题时，可以想着一位对你重要的人，尽量以同一段关系为参照，按平时的真实感受回答；也可以根据让自己舒服的相处方式作答。</p><p>本测试为原创自我探索工具，未经心理测量学验证。结果描述本次回答中的偏好，不用于心理诊断、人格定论或关系匹配预测。</p><p>你可以用结果开启一次谈话：“这里有点像我，你呢？”</p></div>'); break;
    case 'privacy': openModal('这份来信，先留给自己', '<div class="modal-copy"><p>答题进度仅保存在当前浏览器的本地存储中。本应用不会将答案或结果上传，也没有账号和追踪统计。生成次数仅在本浏览器累计保存，清除本地测试数据时会一并重置。</p><p>在共用设备上使用时，其他使用该浏览器的人可能看到保留的进度。你可以点击下方按钮清除。</p><p>分享卡片由当前浏览器生成并下载，由你决定是否发送。卡片不包含逐题答案。</p><button class="button secondary" data-action="clear">清除本地测试数据</button></div>'); break;
    case 'clear':
      try { localStorage.removeItem(storageKey); localStorage.removeItem(testCountKey); } catch { /* Cleared in memory below. */ }
      testCount = 0;
      state = { answers: Array(24).fill(null), index: 0, screen: 'home' }; result = undefined; modal.close(); home(); toast('本地测试数据已清除。'); break;
    case 'restart': openModal('重新认识此刻的自己', '<p class="modal-lead">重新开始会清除这次的答题进度。你可以先保存已经生成的卡片。</p><div class="modal-actions"><button class="button secondary" data-action="close">保留这次进度</button><button class="button primary" data-action="confirm-restart">重新开始</button></div>'); break;
    case 'confirm-restart': state.answers = Array(24).fill(null); state.index = 0; state.needsGeneration = false; modal.close(); start(); break;
    case 'share': openShare(); break;
    case 'copy': copyNotes(); break;
  }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'share-form') return;
  event.preventDefault();
  downloadCard(document.querySelector('#share-name').value.trim(), document.querySelector('#share-message').value);
});
modal.addEventListener('click', event => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close(); } });
document.addEventListener('keydown', event => {
  if (state.screen !== 'quiz' || modal.open || /INPUT|TEXTAREA/.test(event.target.tagName)) return;
  const radios = [...document.querySelectorAll('[data-answer]')];
  if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key) && event.target.matches('[data-answer]')) {
    event.preventDefault(); const step = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
    const next = radios[(radios.indexOf(event.target) + step + 4) % 4]; next.focus(); next.click();
  }
  if (/^[1-4]$/.test(event.key)) radios[Number(event.key) - 1]?.click();
});
function openLinkedScreen() {
  if (location.hash === '#cats') gallery('all');
  else {
    const match = /^#cat-([1-9]|1[0-6])$/.exec(location.hash);
    if (match) showResult(true, false, Number(match[1]) - 1);
    else home();
  }
}
window.addEventListener('hashchange', openLinkedScreen);
openLinkedScreen();
