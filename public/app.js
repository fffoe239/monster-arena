const socket = io();

const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const authStatus = document.getElementById('authStatus');

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

const playerName = document.getElementById('playerName');
const coinsEl = document.getElementById('coins');
const weaponNameEl = document.getElementById('weaponName');
const damageEl = document.getElementById('damage');

let currentUser = null;

function updateHud(user) {
  if (!user) return;
  playerName.textContent = user.username;
  coinsEl.textContent = user.coins;
  weaponNameEl.textContent = user.weapon.toUpperCase();
  damageEl.textContent = user.damage;
}

document.getElementById('registerBtn').addEventListener('click', () => {
  socket.emit('register', {
    username: usernameInput.value.trim(),
    password: passwordInput.value
  });
});

document.getElementById('loginBtn').addEventListener('click', () => {
  socket.emit('login', {
    username: usernameInput.value.trim(),
    password: passwordInput.value
  });
});

socket.on('register_result', (res) => {
  authStatus.textContent = res.message;
});

socket.on('login_result', (res) => {
  if (!res.ok) {
    authStatus.textContent = res.message;
    return;
  }

  currentUser = res.user;
  updateHud(currentUser);
  loginScreen.classList.remove('active');
  gameScreen.classList.add('active');
  authStatus.textContent = '';
});

document.querySelectorAll('[data-weapon]').forEach((button) => {
  button.addEventListener('click', () => {
    const weapon = button.dataset.weapon;
    const price = Number(button.dataset.price || 0);
    socket.emit('buy_weapon', { weapon, price });
  });
});

socket.on('shop_result', (res) => {
  if (!res.ok) {
    alert(res.message);
    return;
  }

  currentUser = { ...currentUser, ...res.user };
  updateHud(currentUser);
  alert(res.message);
});

document.querySelectorAll('.difficulty').forEach((button) => {
  button.addEventListener('click', () => {
    socket.emit('battle', { difficulty: button.dataset.difficulty });
  });
});

socket.on('battle_result', (res) => {
  const resultBox = document.getElementById('battleResult');
  resultBox.textContent = `المستوى: ${res.difficulty} | الجائزة: ${res.reward} | الإجمالي: ${res.totalCoins}`;
  coinsEl.textContent = res.totalCoins;
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  currentUser = null;
  gameScreen.classList.remove('active');
  loginScreen.classList.add('active');
});
