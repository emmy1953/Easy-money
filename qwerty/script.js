const STORAGE_KEY = "easyMoneyState.v1";

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const seedUsers = [
  {
    id: createId(),
    name: "Maya Bennett",
    username: "maya",
    password: "password123",
    balance: 8750,
    createdAt: new Date().toISOString(),
  },
  {
    id: createId(),
    name: "Alex Morgan",
    username: "alex",
    password: "password123",
    balance: 4200,
    createdAt: new Date().toISOString(),
  },
];

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

let state = loadState();

const authView = document.querySelector("#authView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const showLogin = document.querySelector("#showLogin");
const showSignup = document.querySelector("#showSignup");
const loginMessage = document.querySelector("#loginMessage");
const signupMessage = document.querySelector("#signupMessage");
const transferForm = document.querySelector("#transferForm");
const receiveForm = document.querySelector("#receiveForm");
const recipientUsername = document.querySelector("#recipientUsername");
const transferMessage = document.querySelector("#transferMessage");
const receiveMessage = document.querySelector("#receiveMessage");
const sendTab = document.querySelector("#sendTab");
const receiveTab = document.querySelector("#receiveTab");
const receiveBox = document.querySelector("#receiveBox");
const logoutBtn = document.querySelector("#logoutBtn");
const balanceAmount = document.querySelector("#balanceAmount");
const welcomeTitle = document.querySelector("#welcomeTitle");
const activeUserLabel = document.querySelector("#activeUserLabel");
const accountUsername = document.querySelector("#accountUsername");
const receiveUsername = document.querySelector("#receiveUsername");
const copyUsernameBtn = document.querySelector("#copyUsernameBtn");
const copyMessage = document.querySelector("#copyMessage");
const activityList = document.querySelector("#activityList");
const userList = document.querySelector("#userList");
const sentTotal = document.querySelector("#sentTotal");
const receivedTotal = document.querySelector("#receivedTotal");
const transferCount = document.querySelector("#transferCount");
const seedInfoBtn = document.querySelector("#seedInfoBtn");
const clearActivityBtn = document.querySelector("#clearActivityBtn");

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return {
      users: seedUsers,
      transfers: [],
      activeUserId: null,
    };
  }

  try {
    const parsed = JSON.parse(stored);
    return {
      users: normalizeUsers(Array.isArray(parsed.users) ? parsed.users : seedUsers),
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
      activeUserId: parsed.activeUserId || null,
    };
  } catch {
    return {
      users: seedUsers,
      transfers: [],
      activeUserId: null,
    };
  }
}

function normalizeUsers(users) {
  return users.map((user) => ({
    ...user,
    username: normalizeUsername(user.username || ""),
    balance: Number.isFinite(Number(user.balance)) ? Number(user.balance) : 5000,
  }));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeUsername(username) {
  return username.trim().toLowerCase().replace(/^@/, "");
}

function getActiveUser() {
  return state.users.find((user) => user.id === state.activeUserId) || null;
}

function findUserByUsername(username) {
  const normalized = normalizeUsername(username);
  return state.users.find((user) => user.username === normalized) || null;
}

function setMessage(element, text, type = "error") {
  element.textContent = text;
  element.classList.toggle("success", type === "success");
}

function switchAuthMode(mode) {
  const isLogin = mode === "login";
  loginForm.classList.toggle("hidden", !isLogin);
  signupForm.classList.toggle("hidden", isLogin);
  showLogin.classList.toggle("active", isLogin);
  showSignup.classList.toggle("active", !isLogin);
  setMessage(loginMessage, "");
  setMessage(signupMessage, "");
}

function switchTransferMode(mode) {
  const isSend = mode === "send";
  transferForm.classList.toggle("active", isSend);
  receiveBox.classList.toggle("active", !isSend);
  sendTab.classList.toggle("active", isSend);
  receiveTab.classList.toggle("active", !isSend);
  setMessage(transferMessage, "");
  setMessage(receiveMessage, "");
  setMessage(copyMessage, "");
}

function showDashboard() {
  authView.style.display = "none";
  dashboardView.style.display = "block";
  renderDashboard();
}

function showAuth() {
  authView.style.display = "grid";
  dashboardView.style.display = "none";
}

function renderDashboard() {
  const activeUser = getActiveUser();

  if (!activeUser) {
    showAuth();
    return;
  }

  welcomeTitle.textContent = `Good day, ${activeUser.name.split(" ")[0]}`;
  activeUserLabel.textContent = `@${activeUser.username}`;
  accountUsername.textContent = `@${activeUser.username}`;
  receiveUsername.value = activeUser.username;
  balanceAmount.textContent = moneyFormatter.format(activeUser.balance);

  const userTransfers = state.transfers.filter(
    (transfer) =>
      (transfer.senderId === activeUser.id || transfer.recipientId === activeUser.id) &&
      !transfer.hiddenFor?.includes(activeUser.id),
  );

  const sent = userTransfers
    .filter((transfer) => transfer.senderId === activeUser.id)
    .reduce((sum, transfer) => sum + transfer.amount, 0);
  const received = userTransfers
    .filter((transfer) => transfer.recipientId === activeUser.id)
    .reduce((sum, transfer) => sum + transfer.amount, 0);

  sentTotal.textContent = moneyFormatter.format(sent);
  receivedTotal.textContent = moneyFormatter.format(received);
  transferCount.textContent = String(userTransfers.length);

  renderActivity(userTransfers, activeUser);
  renderUsers(activeUser);
}

function renderActivity(transfers, activeUser) {
  activityList.innerHTML = "";

  if (!transfers.length) {
    activityList.innerHTML = '<div class="empty-state">No transfers yet. Send or receive money to build activity.</div>';
    return;
  }

  [...transfers]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((transfer) => {
      const isCredit = transfer.recipientId === activeUser.id;
      const isDeposit = transfer.type === "deposit";
      const otherUser = state.users.find((user) => user.id === (isCredit ? transfer.senderId : transfer.recipientId));
      const activityTitle = isDeposit
        ? `Received from ${escapeHtml(transfer.source || "external source")}`
        : `${isCredit ? "Received from" : "Sent to"} @${otherUser?.username || "unknown"}`;
      const item = document.createElement("article");
      item.className = "activity-item";

      item.innerHTML = `
        <div class="activity-icon">${isCredit ? "+" : "-"}</div>
        <div>
          <div class="activity-title">${activityTitle}</div>
          <div class="activity-meta">${dateFormatter.format(new Date(transfer.createdAt))}${transfer.note ? ` - ${escapeHtml(transfer.note)}` : ""}</div>
        </div>
        <div class="activity-amount ${isCredit ? "credit" : "debit"}">
          ${isCredit ? "+" : "-"}${moneyFormatter.format(transfer.amount)}
          <br />
          <button class="receipt-btn" type="button" data-receipt-id="${transfer.id}">Receipt</button>
        </div>
      `;

      activityList.appendChild(item);
    });
}

function renderUsers(activeUser) {
  userList.innerHTML = "";

  const payableUsers = state.users.filter((user) => user.id !== activeUser.id);

  if (!payableUsers.length) {
    userList.innerHTML = '<div class="empty-state">Create another account to test username transfers.</div>';
    return;
  }

  payableUsers.forEach((user) => {
    const item = document.createElement("article");
    item.className = "activity-item";
    item.innerHTML = `
      <div class="activity-icon">${user.name.charAt(0).toUpperCase()}</div>
      <div>
        <div class="activity-title">${escapeHtml(user.name)}</div>
        <div class="activity-meta">@${user.username}</div>
      </div>
      <button class="recipient-btn" type="button" data-pay-username="${user.username}">Pay</button>
    `;
    userList.appendChild(item);
  });
}

function handleLogin(event) {
  event.preventDefault();
  const data = new FormData(loginForm);
  const username = normalizeUsername(data.get("username") || "");
  const password = String(data.get("password") || "");
  const user = state.users.find((candidate) => candidate.username === username && candidate.password === password);

  if (!user) {
    setMessage(loginMessage, "Username or password is incorrect. Try maya / password123 for a demo account.");
    return;
  }

  state.activeUserId = user.id;
  saveState();
  loginForm.reset();
  showDashboard();
}

function handleSignup(event) {
  event.preventDefault();
  const data = new FormData(signupForm);
  const name = String(data.get("name") || "").trim();
  const username = normalizeUsername(data.get("username") || "");
  const password = String(data.get("password") || "");

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    setMessage(signupMessage, "Use 3-20 characters: lowercase letters, numbers, or underscores.");
    return;
  }

  if (state.users.some((user) => user.username === username)) {
    setMessage(signupMessage, "That username is already in use.");
    return;
  }

  const user = {
    id: createId(),
    name,
    username,
    password,
    balance: 5000,
    createdAt: new Date().toISOString(),
  };

  state.users.push(user);
  state.activeUserId = user.id;
  saveState();
  signupForm.reset();
  showDashboard();
}

function handleTransfer(event) {
  event.preventDefault();
  const activeUser = getActiveUser();
  const data = new FormData(transferForm);
  const recipient = findUserByUsername(data.get("recipient") || "");
  const amount = Number(data.get("amount"));
  const note = String(data.get("note") || "").trim();

  if (!activeUser) return;

  if (!recipient) {
    setMessage(transferMessage, "No Easy Money user exists with that username.");
    return;
  }

  if (recipient.id === activeUser.id) {
    setMessage(transferMessage, "You cannot send money to your own account.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    setMessage(transferMessage, "Enter a valid transfer amount.");
    return;
  }

  if (amount > activeUser.balance) {
    setMessage(transferMessage, "Your mock balance is not high enough for this transfer.");
    return;
  }

  const transfer = {
    id: createId(),
    senderId: activeUser.id,
    recipientId: recipient.id,
    amount: Math.round(amount * 100) / 100,
    note,
    createdAt: new Date().toISOString(),
  };

  activeUser.balance = Math.round((activeUser.balance - transfer.amount) * 100) / 100;
  recipient.balance = Math.round((recipient.balance + transfer.amount) * 100) / 100;
  state.transfers.push(transfer);
  saveState();

  transferForm.reset();
  setMessage(transferMessage, `Transfer sent to @${recipient.username}. Your receipt is ready below.`, "success");
  renderDashboard();
  downloadReceipt(transfer.id);
}

function handleReceive(event) {
  event.preventDefault();
  const activeUser = getActiveUser();
  const data = new FormData(receiveForm);
  const amount = Number(data.get("amount"));
  const source = String(data.get("source") || "").trim();
  const note = String(data.get("note") || "").trim();

  if (!activeUser) return;

  if (!Number.isFinite(amount) || amount <= 0) {
    setMessage(receiveMessage, "Enter a valid amount to receive.");
    return;
  }

  if (!source) {
    setMessage(receiveMessage, "Add who or where the money came from.");
    return;
  }

  const transfer = {
    id: createId(),
    type: "deposit",
    senderId: null,
    recipientId: activeUser.id,
    amount: Math.round(amount * 100) / 100,
    source,
    note,
    createdAt: new Date().toISOString(),
  };

  activeUser.balance = Math.round((activeUser.balance + transfer.amount) * 100) / 100;
  state.transfers.push(transfer);
  saveState();

  receiveForm.reset();
  renderDashboard();
  switchTransferMode("receive");
  setMessage(receiveMessage, "Money received. Your receipt is ready below.", "success");
  downloadReceipt(transfer.id);
}

function downloadReceipt(transferId) {
  const transfer = state.transfers.find((item) => item.id === transferId);
  if (!transfer) return;

  const sender = state.users.find((user) => user.id === transfer.senderId);
  const recipient = state.users.find((user) => user.id === transfer.recipientId);
  const issuedAt = dateFormatter.format(new Date(transfer.createdAt));
  const isDeposit = transfer.type === "deposit";

  const receipt = [
    isDeposit ? "Easy Money Payment Receipt" : "Easy Money Transfer Receipt",
    isDeposit ? "--------------------------" : "---------------------------",
    `Receipt ID: ${transfer.id}`,
    `Date: ${issuedAt}`,
    `Type: ${isDeposit ? "Received payment" : "Username transfer"}`,
    `Sender: ${isDeposit ? transfer.source || "External source" : `${sender?.name || "Unknown"} (@${sender?.username || "unknown"})`}`,
    `Recipient: ${recipient?.name || "Unknown"} (@${recipient?.username || "unknown"})`,
    `Amount: ${moneyFormatter.format(transfer.amount)}`,
    `Note: ${transfer.note || "No note provided"}`,
    "",
    "This is a mock transaction receipt. No real money moved.",
  ].join("\n");

  const blob = new Blob([receipt], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `easy-money-receipt-${transfer.id.slice(0, 8)}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

showLogin.addEventListener("click", () => switchAuthMode("login"));
showSignup.addEventListener("click", () => switchAuthMode("signup"));
sendTab.addEventListener("click", () => switchTransferMode("send"));
receiveTab.addEventListener("click", () => switchTransferMode("receive"));
loginForm.addEventListener("submit", handleLogin);
signupForm.addEventListener("submit", handleSignup);
transferForm.addEventListener("submit", handleTransfer);
receiveForm.addEventListener("submit", handleReceive);

logoutBtn.addEventListener("click", () => {
  state.activeUserId = null;
  saveState();
  showAuth();
});

copyUsernameBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(receiveUsername.value);
    setMessage(copyMessage, "Username copied.", "success");
  } catch {
    receiveUsername.select();
    document.execCommand("copy");
    setMessage(copyMessage, "Username copied.", "success");
  }
});

activityList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-receipt-id]");
  if (button) {
    downloadReceipt(button.dataset.receiptId);
  }
});

userList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pay-username]");
  if (!button) return;

  switchTransferMode("send");
  recipientUsername.value = button.dataset.payUsername;
  recipientUsername.focus();
  setMessage(transferMessage, `Ready to send money to @${button.dataset.payUsername}.`, "success");
});

seedInfoBtn.addEventListener("click", () => {
  alert("Demo accounts:\n\nmaya / password123\nalex / password123");
});

clearActivityBtn.addEventListener("click", () => {
  const activeUser = getActiveUser();
  if (!activeUser) return;

  state.transfers = state.transfers.map((transfer) => {
    if (transfer.senderId !== activeUser.id && transfer.recipientId !== activeUser.id) {
      return transfer;
    }

    const hiddenFor = new Set(transfer.hiddenFor || []);
    hiddenFor.add(activeUser.id);
    return {
      ...transfer,
      hiddenFor: [...hiddenFor],
    };
  });
  saveState();
  renderDashboard();
});

if (getActiveUser()) {
  showDashboard();
} else {
  showAuth();
}
