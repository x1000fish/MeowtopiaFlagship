(function () {
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzR0J0VXyl5ayKwDXlHimc4WS1FjvGEb2-gTBMhum8APQKfDHxc5wsiWRkNqkxJrocMOw/exec';
  const USER_KEY = 'currentUser';
  const LEVEL_KEY = 'currentLevel';
  const PLACEMENT_LEVEL_OFFSET = 100;

  let leaderboardData = [];
  let activeRankType = 'steps';

  function getCurrentUser() {
    return sessionStorage.getItem(USER_KEY) || '';
  }

  function getPageLevel() {
    const match = window.location.pathname.match(/level-(\d+)\.html$/i);
    if (match) {
      return parseInt(match[1], 10);
    }

    const solution = document.body?.dataset?.solution;
    return parseInt(solution || '1', 10);
  }

  function getLeaderboardLevel() {
    return PLACEMENT_LEVEL_OFFSET + getPageLevel();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setMessage(text, tone = '') {
    const message = document.getElementById('account-message');
    if (!message) {
      return;
    }

    message.textContent = text;
    message.dataset.tone = tone;
  }

  function setButtonBusy(button, isBusy, label, busyLabel) {
    if (!button) {
      return;
    }

    button.disabled = isBusy;
    button.textContent = isBusy ? busyLabel : label;
  }

  function showRegisterPanel(showRegister) {
    const login = document.getElementById('account-login-panel');
    const register = document.getElementById('account-register-panel');
    if (!login || !register) {
      return;
    }

    login.hidden = showRegister;
    register.hidden = !showRegister;
    setMessage('');
  }

  async function handleLogin() {
    const username = document.getElementById('account-login-user')?.value.trim();
    const password = document.getElementById('account-login-pass')?.value.trim();
    const button = document.getElementById('account-login-btn');

    if (!username || !password) {
      setMessage('Please enter both username and password.', 'error');
      return;
    }

    setButtonBusy(button, true, 'START', 'WAITING...');
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'auth', username, password })
      });
      const result = await response.json();

      if (result.status === 'success') {
        sessionStorage.setItem(USER_KEY, username);
        sessionStorage.setItem(LEVEL_KEY, result.level || '1');
        renderHomeAccount();
        return;
      }

      if (result.status === 'wrong_password') {
        setMessage('Wrong password.', 'error');
      } else {
        setMessage('Account not found. Please register first.', 'error');
        showRegisterPanel(true);
        document.getElementById('account-reg-user')?.focus();
      }
    } catch (error) {
      setMessage('Connection failed. Please try again.', 'error');
    } finally {
      setButtonBusy(button, false, 'START', 'WAITING...');
    }
  }

  async function handleRegister() {
    const username = document.getElementById('account-reg-user')?.value.trim();
    const password = document.getElementById('account-reg-pass')?.value.trim();
    const confirm = document.getElementById('account-reg-confirm')?.value.trim();
    const button = document.getElementById('account-reg-btn');

    if (!username || !password || !confirm) {
      setMessage('Please fill all fields.', 'error');
      return;
    }

    if (password !== confirm) {
      setMessage('Passwords do not match.', 'error');
      return;
    }

    setButtonBusy(button, true, 'JOIN NOW', 'WAITING...');
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'register', username, password })
      });
      const result = await response.text();

      if (result === 'success') {
        setMessage('Registration successful. Please login.', 'success');
        showRegisterPanel(false);
        const loginUser = document.getElementById('account-login-user');
        if (loginUser) {
          loginUser.value = username;
        }
        document.getElementById('account-login-pass')?.focus();
      } else if (result === 'exists') {
        setMessage('Username already taken.', 'error');
      } else {
        setMessage('Registration failed.', 'error');
      }
    } catch (error) {
      setMessage('Connection failed. Please try again.', 'error');
    } finally {
      setButtonBusy(button, false, 'JOIN NOW', 'WAITING...');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(LEVEL_KEY);
    renderHomeAccount();
  }

  function buildAuthCard() {
    const panel = document.createElement('section');
    panel.id = 'account-auth-card';
    panel.className = 'account-auth-card';
    panel.innerHTML = `
      <div class="account-auth-copy">
        <span class="hero-badge">Account</span>
        <h2>Login To Play</h2>
      </div>
      <div class="account-auth-forms">
        <div id="account-login-panel" class="account-form-panel">
          <label for="account-login-user">Name</label>
          <input id="account-login-user" class="account-input" type="text" autocomplete="username" placeholder="Your name">
          <label for="account-login-pass">Password</label>
          <input id="account-login-pass" class="account-input" type="password" autocomplete="current-password" placeholder="Password">
          <button id="account-login-btn" class="account-primary-btn" type="button">START</button>
          <button id="account-show-register" class="account-link-btn" type="button">New cat? Register</button>
        </div>
        <div id="account-register-panel" class="account-form-panel" hidden>
          <label for="account-reg-user">Name</label>
          <input id="account-reg-user" class="account-input" type="text" autocomplete="username" placeholder="Name your cat">
          <label for="account-reg-pass">Password</label>
          <input id="account-reg-pass" class="account-input" type="password" autocomplete="new-password" placeholder="Password">
          <label for="account-reg-confirm">Confirm</label>
          <input id="account-reg-confirm" class="account-input" type="password" autocomplete="new-password" placeholder="Repeat password">
          <button id="account-reg-btn" class="account-primary-btn" type="button">JOIN NOW</button>
          <button id="account-show-login" class="account-link-btn" type="button">Go back to login</button>
        </div>
        <p id="account-message" class="account-message" aria-live="polite"></p>
      </div>
    `;
    return panel;
  }

  function buildProfileCard(username) {
    const panel = document.createElement('section');
    panel.id = 'account-profile-card';
    panel.className = 'account-profile-card';
    panel.innerHTML = `
      <div class="account-avatar" aria-hidden="true">CAT</div>
      <div class="account-profile-copy">
        <span class="hero-badge">Signed In</span>
        <strong>${escapeHtml(username)}</strong>
      </div>
      <button id="account-logout-btn" class="account-secondary-btn" type="button">LOGOUT</button>
    `;
    return panel;
  }

  function wireAuthCard() {
    document.getElementById('account-login-btn')?.addEventListener('click', handleLogin);
    document.getElementById('account-reg-btn')?.addEventListener('click', handleRegister);
    document.getElementById('account-show-register')?.addEventListener('click', () => showRegisterPanel(true));
    document.getElementById('account-show-login')?.addEventListener('click', () => showRegisterPanel(false));

    ['account-login-pass', 'account-reg-confirm'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          if (id === 'account-login-pass') {
            handleLogin();
          } else {
            handleRegister();
          }
        }
      });
    });
  }

  function renderHomeAccount() {
    if (!document.body.classList.contains('game-home')) {
      return;
    }

    const levelPanel = document.querySelector('.level-select-panel');
    const existing = document.getElementById('account-auth-card') || document.getElementById('account-profile-card');
    existing?.remove();

    const username = getCurrentUser();
    if (username) {
      levelPanel?.classList.remove('account-locked');
      const profile = buildProfileCard(username);
      document.querySelector('.game-home-hero')?.after(profile);
      document.getElementById('account-logout-btn')?.addEventListener('click', handleLogout);
      return;
    }

    levelPanel?.classList.add('account-locked');
    const authCard = buildAuthCard();
    document.querySelector('.game-home-hero')?.after(authCard);
    wireAuthCard();
  }

  function requireLevelLogin() {
    if (!document.body.classList.contains('game-level')) {
      return;
    }

    if (!getCurrentUser()) {
      window.location.href = 'index.html';
    }
  }

  function createLeaderboard() {
    if (!document.body.classList.contains('game-level') || document.getElementById('leaderboard-wrapper')) {
      return;
    }

    const wrapper = document.createElement('aside');
    wrapper.id = 'leaderboard-wrapper';
    wrapper.className = 'placement-leaderboard';
    wrapper.innerHTML = `
      <div class="side-leaderboard-content">
        <h3>Leaderboard</h3>
        <div class="rank-tabs" role="tablist" aria-label="Leaderboard sort">
          <button id="tab-steps" class="rank-tab active" type="button">CATS</button>
          <button id="tab-time" class="rank-tab" type="button">TIME</button>
        </div>
        <div id="rankList" class="rank-list" aria-live="polite">Loading...</div>
      </div>
      <button class="bookmark-tab" type="button" aria-label="Toggle leaderboard">
        <span class="bookmark-text">RANK</span>
      </button>
    `;
    document.body.appendChild(wrapper);

    wrapper.querySelector('.bookmark-tab')?.addEventListener('click', toggleLeaderboard);
    document.getElementById('tab-steps')?.addEventListener('click', () => renderRank('steps'));
    document.getElementById('tab-time')?.addEventListener('click', () => renderRank('time'));
    fetchLeaderboard();
  }

  function toggleLeaderboard() {
    document.getElementById('leaderboard-wrapper')?.classList.toggle('expanded');
  }

  async function fetchLeaderboard() {
    const listArea = document.getElementById('rankList');
    if (!listArea) {
      return;
    }

    listArea.textContent = 'Loading...';
    try {
      const response = await fetch(`${SCRIPT_URL}?action=getLeaderboard&level=${encodeURIComponent(getLeaderboardLevel())}`);
      const data = await response.json();
      leaderboardData = Array.isArray(data) ? data : [];
      renderRank(activeRankType);
    } catch (error) {
      listArea.innerHTML = '<p class="rank-empty rank-error">Load Error</p>';
    }
  }

  function renderRank(type) {
    activeRankType = type;
    const tabSteps = document.getElementById('tab-steps');
    const tabTime = document.getElementById('tab-time');
    const listArea = document.getElementById('rankList');
    if (!listArea) {
      return;
    }

    tabSteps?.classList.toggle('active', type === 'steps');
    tabTime?.classList.toggle('active', type === 'time');

    if (!leaderboardData.length) {
      listArea.innerHTML = '<p class="rank-empty">No records yet</p>';
      return;
    }

    const sorted = [...leaderboardData].sort((a, b) => Number(a[type] || Infinity) - Number(b[type] || Infinity));
    listArea.innerHTML = sorted.slice(0, 10).map((item, index) => {
      const name = escapeHtml(item.username || item.name || 'Anonymous');
      const value = type === 'steps'
        ? `${escapeHtml(item.steps ?? '-')} cats`
        : `${escapeHtml(item.time ?? '-')}s`;
      return `
        <div class="rank-item">
          <span>${index + 1}. ${name}</span>
          <strong>${value}</strong>
        </div>
      `;
    }).join('');
  }

  function savePlacementRecord(record) {
    const username = getCurrentUser();
    if (!username || !record) {
      return Promise.resolve(false);
    }

    const payload = {
      action: 'saveRecord',
      username,
      level: getLeaderboardLevel(),
      steps: Number(record.steps || 0),
      time: Number(record.time || 0),
      circuit: record.circuit || '',
      game: 'placement',
      displayLevel: getPageLevel()
    };

    return fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(payload)
    }).then(() => {
      setTimeout(fetchLeaderboard, 1200);
      return true;
    }).catch(() => false);
  }

  function init() {
    renderHomeAccount();
    requireLevelLogin();
    createLeaderboard();
  }

  window.MeowtopiaAccount = {
    getCurrentUser,
    savePlacementRecord,
    fetchLeaderboard
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
