const API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const STORAGE_KEYS = { saved: "wordly-saved", theme: "wordly-theme" };

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const message = document.getElementById("message");
const card = document.getElementById("word-card");
const titleEl = document.getElementById("word-title");
const phoneticEl = document.getElementById("word-phonetic");
const meaningsEl = document.getElementById("meanings");
const audioBtn = document.getElementById("audio-btn");
const audioFallback = document.getElementById("audio-fallback");
const saveBtn = document.getElementById("save-btn");
const savedList = document.getElementById("saved-list");
const savedEmpty = document.getElementById("saved-empty");
const themeToggle = document.getElementById("theme-toggle");

let currentWord = "";
let currentAudio = null;
let savedWords = loadSaved();

/* ---------- Storage helpers ---------- */
function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.saved)) || [];
  } catch {
    return [];
  }
}

function persistSaved() {
  localStorage.setItem(STORAGE_KEYS.saved, JSON.stringify(savedWords));
}

/* ---------- Messages ---------- */
function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.hidden = false;
}

function clearMessage() {
  message.hidden = true;
  message.textContent = "";
}

/* ---------- Fetch ---------- */
async function fetchWord(word, rextries = 2) {
    try {
        const response = await fetch(API_URL + encodeURIComponent(word));
        if (response.status === 404){
            throw new Error("NOT_FOUND");
        }
        if (!response.ok) {
            throw new Error("API_ERROR");
        }
        const data = await response.json();
        return data[0];
    } catch (error) {
        if (error.message === "NOT_FOUND" || retries === 0) {
            throw error;
        }
        return fetchWord(word, retries - 1);
    }
}

/* ---------- Parsing ---------- */
function getPhonetic(entry) {
  if (entry.phonetic) return entry.phonetic;
  const withText = (entry.phonetics || []).find((p) => p.text);
  return withText ? withText.text : "";
}

function getAudioUrl(entry) {
  const withAudio = (entry.phonetics || []).find((p) => p.audio);
  if (!withAudio) return "";
  return withAudio.audio.startsWith("//") ? "https:" + withAudio.audio : withAudio.audio;
}

/* ---------- Rendering ---------- */
function renderMeanings(meanings) {
  meaningsEl.replaceChildren();

  meanings.forEach((meaning) => {
    const block = document.createElement("div");
    block.className = "meaning";

    const pos = document.createElement("h3");
    pos.textContent = meaning.partOfSpeech;
    block.appendChild(pos);

    const list = document.createElement("ol");
    meaning.definitions.slice(0, 3).forEach((def) => {
      const item = document.createElement("li");
      item.textContent = def.definition;
      if (def.example) {
        const example = document.createElement("p");
        example.className = "example";
        example.textContent = `Example: "${def.example}"`;
        item.appendChild(example);
      }
      list.appendChild(item);
    });
    block.appendChild(list);

    const synonyms = meaning.synonyms || [];
    const synonymLine = document.createElement("p");
    synonymLine.className = "synonyms";
    synonymLine.textContent = synonyms.length
      ? `Synonyms: ${synonyms.slice(0, 6).join(", ")}`
      : "No synonyms available for this part of speech.";
    block.appendChild(synonymLine);

    meaningsEl.appendChild(block);
  });
}

function renderEntry(entry) {
  currentWord = entry.word.toLowerCase();
  titleEl.textContent = entry.word;
  phoneticEl.textContent = getPhonetic(entry) || "Pronunciation not available";

  const audioUrl = getAudioUrl(entry);
  currentAudio = audioUrl ? new Audio(audioUrl) : null;
  audioBtn.hidden = !currentAudio;
  audioFallback.hidden = Boolean(currentAudio);

  renderMeanings(entry.meanings);
  card.hidden = false;
  updateSaveState();
}

/* ---------- Saved words ---------- */
function updateSaveState() {
  const isSaved = savedWords.includes(currentWord);
  card.classList.toggle("is-saved", isSaved);
  saveBtn.textContent = isSaved ? "Remove from saved" : "Save word";
  saveBtn.setAttribute("aria-pressed", String(isSaved));
}

function renderSaved() {
  savedList.replaceChildren();
  savedEmpty.hidden = savedWords.length > 0;

  savedWords.forEach((word) => {
    const item = document.createElement("li");
    item.className = "chip";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = word;
    button.setAttribute("aria-label", `Look up saved word ${word}`);
    button.addEventListener("click", () => {
      input.value = word;
      searchWord(word);
    });

    item.appendChild(button);
    savedList.appendChild(item);
  });
}

function toggleSave() {
  if (!currentWord) return;
  savedWords = savedWords.includes(currentWord)
    ? savedWords.filter((w) => w !== currentWord)
    : [...savedWords, currentWord];
  persistSaved();
  renderSaved();
  updateSaveState();
}

/* ---------- Search flow ---------- */
async function searchWord(rawWord) {
  const word = rawWord.trim();
  clearMessage();

  if (!word) {
    showMessage("Please type a word before searching.", true);
    return;
  }
  if (!/^[a-zA-Z'-]+$/.test(word)) {
    showMessage("Use letters only. Numbers and symbols are not valid words.", true);
    return;
  }

  card.hidden = true;
  showMessage("Looking up the word...");

  try {
    const entry = await fetchWord(word);
    clearMessage();
    renderEntry(entry);
  } catch (error) {
    card.hidden = true;
    if (error.message === "NOT_FOUND") {
      showMessage(`No definition found for "${word}". Check the spelling and try again.`, true);
    } else {
      showMessage("Could not reach the dictionary. Check your connection and try again.", true);
    }
  }
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "Light theme" : "Dark theme";
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

/* ---------- Event listeners ---------- */
form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchWord(input.value);
});

audioBtn.addEventListener("click", () => {
    if (!currentAudio) return;
    currentAudio.play().catch(() => {
        showMessage("Could not play the audio. Try again later.", true);
    });
});

saveBtn.addEventListener("click", toggleSave);

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

/* ---------- Init ---------- */
applyTheme(localStorage.getItem(STORAGE_KEYS.theme) || "light");
renderSaved();