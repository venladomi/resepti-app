import { useEffect, useMemo, useRef, useState } from "react";

const APP_VERSION = "1.6";
const STORAGE_KEY = "reseptiapp.recipes.v1";
const BACKUP_KEY = "reseptiapp.latestBackupAt.v1";
const BACKUP_STALE_DAYS = 14;
const IMPORT_WARNING_RECIPE_COUNT = 10;

const emptyRecipe = () => {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "",
    category: "",
    tags: [],
    ingredients: "",
    instructions: "",
    notes: "",
    servings: "",
    prepTime: "",
    cookTime: "",
    totalTime: "",
    sourceUrl: "",
    image: "",
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
};

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `recipe-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeRecipe(recipe) {
  const now = new Date().toISOString();

  return {
    id: String(recipe?.id || createId()),
    title: String(recipe?.title || ""),
    category: String(recipe?.category || ""),
    tags: Array.isArray(recipe?.tags) ? recipe.tags.map(String) : [],
    ingredients: String(recipe?.ingredients || ""),
    instructions: String(recipe?.instructions || ""),
    notes: String(recipe?.notes || ""),
    servings: String(recipe?.servings || ""),
    prepTime: String(recipe?.prepTime || ""),
    cookTime: String(recipe?.cookTime || ""),
    totalTime: String(recipe?.totalTime || ""),
    sourceUrl: String(recipe?.sourceUrl || ""),
    image: String(recipe?.image || ""),
    favorite: Boolean(recipe?.favorite),
    createdAt: String(recipe?.createdAt || now),
    updatedAt: String(recipe?.updatedAt || now),
  };
}

function loadRecipes() {
  try {
    // Reseptidata tallennetaan selaimen localStorageen tällä avaimella.
    // Data ei ole lähdekoodissa, joten sovelluksen päivitys ei itsessään nollaa reseptejä.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeRecipe) : [];
  } catch (error) {
    console.error("Reseptien lukeminen epäonnistui", error);
    return [];
  }
}

function saveRecipes(recipes) {
  // Tämä on ainoa paikka, jossa reseptilista kirjoitetaan selaimen localStorageen.
  // Kun Supabase lisätään myöhemmin, tämän rajapinnan voi korvata ilman että reseptin rakenne muuttuu.
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

function formatDateTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function splitTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function compareFinnish(a, b) {
  return a.localeCompare(b, "fi", { sensitivity: "base" });
}

function getCategoryLabel(recipe) {
  return recipe.category.trim() || "Ilman kategoriaa";
}

function getBackupDate() {
  return window.localStorage.getItem(BACKUP_KEY) || "";
}

function getBackupStatus(value) {
  if (!value) {
    return {
      stale: true,
      message: "Varmuuskopiota ei ole vielä tehty.",
    };
  }

  const backupTime = new Date(value).getTime();
  if (!Number.isFinite(backupTime)) {
    return {
      stale: true,
      message: "Varmuuskopion päivämäärää ei voitu lukea.",
    };
  }

  const ageInDays = Math.floor((Date.now() - backupTime) / (1000 * 60 * 60 * 24));
  if (ageInDays >= BACKUP_STALE_DAYS) {
    return {
      stale: true,
      message: `Varmuuskopiosta on ${ageInDays} päivää. Vie uusi varmuuskopio.`,
    };
  }

  return { stale: false, message: "" };
}

function parsePositiveNumber(value) {
  const normalized = String(value || "")
    .replace(",", ".")
    .match(/\d+(?:\.\d+)?/);

  if (!normalized) return null;

  const number = Number(normalized[0]);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseServings(value) {
  return parsePositiveNumber(value);
}

const FRACTION_CHARACTERS = "¼½¾⅓⅔⅛⅜⅝⅞";
const AMOUNT_PATTERN = [
  "\\d+(?:[,.]\\d+)?\\s+\\d+\\/\\d+",
  `\\d+(?:[,.]\\d+)?\\s+[${FRACTION_CHARACTERS}]`,
  "\\d+\\/\\d+",
  `[${FRACTION_CHARACTERS}]`,
  `\\d+(?:[,.]\\d+)?(?:\\s*[-–]\\s*(?:\\d+(?:[,.]\\d+)?\\s+\\d+\\/\\d+|\\d+(?:[,.]\\d+)?\\s+[${FRACTION_CHARACTERS}]|\\d+\\/\\d+|[${FRACTION_CHARACTERS}]|\\d+(?:[,.]\\d+)?))?`,
].join("|");

function formatNumber(value) {
  if (!Number.isFinite(value)) return "";

  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const fraction = Math.round((rounded - whole) * 4);
  const fractionMap = ["", "¼", "½", "¾"];

  if (fraction === 0) return String(whole);
  if (whole === 0) return fractionMap[fraction];
  return `${whole} ${fractionMap[fraction]}`;
}

function parseAmount(value) {
  const text = String(value || "").trim();
  const fractionValues = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875,
  };

  if (fractionValues[text]) return fractionValues[text];

  const mixed = text.match(/^(\d+(?:[,.]\d+)?)\s+([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (mixed) {
    return Number(mixed[1].replace(",", ".")) + fractionValues[mixed[2]];
  }

  const mixedSlash = text.match(/^(\d+(?:[,.]\d+)?)\s+(\d+)\/(\d+)$/);
  if (mixedSlash) {
    return Number(mixedSlash[1].replace(",", ".")) + Number(mixedSlash[2]) / Number(mixedSlash[3]);
  }

  const slashFraction = text.match(/^(\d+)\/(\d+)$/);
  if (slashFraction) {
    return Number(slashFraction[1]) / Number(slashFraction[2]);
  }

  const decimal = Number(text.replace(",", "."));
  return Number.isFinite(decimal) ? decimal : null;
}

function scaleAmountText(value, factor) {
  const range = String(value).match(/^(.+?)\s*[-–]\s*(.+)$/u);
  if (range) {
    const first = parseAmount(range[1]);
    const second = parseAmount(range[2]);

    if (first !== null && second !== null) {
      return `${formatNumber(first * factor)}-${formatNumber(second * factor)}`;
    }
  }

  const amount = parseAmount(value);
  return amount === null ? value : formatNumber(amount * factor);
}

function scaleIngredientLine(line, factor) {
  const match = String(line).match(
    new RegExp(`^(\\s*(?:[^\\p{L}\\p{N}${FRACTION_CHARACTERS}]+\\s*)?)(.*)$`, "u")
  );
  if (!match) return line;

  const prefix = match[1];
  const rest = match[2];
  const amountMatch = rest.match(new RegExp(`^(${AMOUNT_PATTERN})(.*)$`, "u"));

  if (!amountMatch) return line;

  return `${prefix}${scaleAmountText(amountMatch[1], factor)}${amountMatch[2]}`;
}

function scaleIngredientText(value, factor) {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.001) {
    return value;
  }

  return String(value || "")
    .split(/\r?\n/)
    .map((line) => scaleIngredientLine(line, factor))
    .join("\n");
}

const INSTRUCTION_UNIT_PATTERN =
  "kg|mg|g|l|dl|cl|ml|rkl|tl|kpl|pkt|prk|pss|pussia?|purkkia?|kuutiota?";

function scaleInstructionText(value, factor) {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.001) {
    return value;
  }

  const amountWithUnit = new RegExp(
    `(${AMOUNT_PATTERN})(\\s*(?:${INSTRUCTION_UNIT_PATTERN})(?=[\\s.,;:!?)\\]]|$))`,
    "giu"
  );

  return String(value || "").replace(amountWithUnit, (match, amount, unit) => {
    return `${scaleAmountText(amount, factor)}${unit}`;
  });
}

async function resizeRecipeImage(file) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);
    const scale = Math.min(1, 1200 / image.width);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    const webp = canvas.toDataURL("image/webp", 0.82);
    if (webp.startsWith("data:image/webp")) {
      return webp;
    }

    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function recipeMatches(recipe, searchTerm, categoryFilter, tagFilter, favoritesOnly) {
  if (favoritesOnly && !recipe.favorite) return false;
  if (categoryFilter && recipe.category !== categoryFilter) return false;
  if (tagFilter && !recipe.tags.includes(tagFilter)) return false;

  const term = searchTerm.trim().toLowerCase();
  if (!term) return true;

  const searchable = [
    recipe.title,
    recipe.ingredients,
    recipe.category,
    recipe.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(term);
}

function getTextSection(line) {
  const normalized = line
    .toLowerCase()
    .replace(/[:：]/g, "")
    .trim();

  if (/^(raaka-aineet|ainekset|tarvikkeet|ingredients)$/.test(normalized)) return "ingredients";
  if (/^(ohje|ohjeet|valmistus|valmistusohje|tee näin|instructions)$/.test(normalized)) {
    return "instructions";
  }
  if (/^(vinkit|vinkki|muistiinpanot|huomiot|notes)$/.test(normalized)) return "notes";

  return "";
}

const RECIPE_TEXT_TEMPLATE = `Nimi: 
Kategoria: 
Tagit: 
Annokset: 
Aktiivinen aika: 
Passiivinen aika: 
Kokonaisaika: 
Lähde: 

Raaka-aineet:

Ohjeet:

Muistiinpanot:`;

function normalizeImportLabel(value) {
  return value
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/\s+/g, " ")
    .trim();
}

function getImportField(line) {
  const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
  if (!match) return null;

  const label = normalizeImportLabel(match[1]);
  const fieldMap = {
    nimi: "title",
    otsikko: "title",
    kategoria: "category",
    tagit: "tags",
    annokset: "servings",
    annosmaara: "servings",
    "aktiivinen aika": "prepTime",
    aktiivinen: "prepTime",
    valmisteluaika: "prepTime",
    "passiivinen aika": "cookTime",
    passiivinen: "cookTime",
    kypsennysaika: "cookTime",
    paistoaika: "cookTime",
    kokonaisaika: "totalTime",
    kokonaisvalmistusaika: "totalTime",
    "valmistusaika yhteensa": "totalTime",
    yhteensa: "totalTime",
    lahde: "sourceUrl",
    lahdelinkki: "sourceUrl",
    linkki: "sourceUrl",
    source: "sourceUrl",
  };

  const field = fieldMap[label];
  return field ? { field, value: match[2].trim() } : null;
}

function stripRecipeTextBullet(line) {
  return line.replace(/^\s*(?:[-*•◆◇♦◦▪▫🔸]\s*)/, "").trim();
}

function lineStartsWithAmount(line) {
  const stripped = stripRecipeTextBullet(line);
  return new RegExp(`^(${AMOUNT_PATTERN})(\\s|$)`, "u").test(stripped);
}

function extractServingsFromLine(line) {
  const match = line.match(/(\d+(?:[,.]\d+)?(?:\s*[-–]\s*\d+(?:[,.]\d+)?)?)\s*(annosta|annos|hlö|henkilölle)/i);
  return match ? `${match[1].replace(/\s+/g, "")} annosta` : "";
}

function extractTimeValue(line) {
  const match = line.match(/(?:aika|time|kesto|valmistus|paisto|kypsennys)[\s:：-]*(.+)$/i);
  if (match?.[1]) return match[1].trim();

  const fallback = line.match(/(\d+\s*(?:min|h|t|tunti|tuntia)[^\n]*)/i);
  return fallback ? fallback[1].trim() : "";
}

function parseRecipeFromText(rawText, sourceUrl) {
  const recipe = emptyRecipe();
  const lines = String(rawText || "")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const buckets = {
    ingredients: [],
    instructions: [],
    notes: [],
  };
  let currentSection = "";

  recipe.sourceUrl = sourceUrl.trim();

  for (const line of lines) {
    const field = getImportField(line);
    if (field) {
      currentSection = "";

      if (field.field === "tags") {
        recipe.tags = splitTags(field.value);
      } else if (field.value) {
        recipe[field.field] = field.value;
      }

      continue;
    }

    const section = getTextSection(line);
    if (section) {
      currentSection = section;
      continue;
    }

    if (!recipe.title && !lineStartsWithAmount(line) && !/^https?:\/\//i.test(line)) {
      recipe.title = line.replace(/[:：]$/, "").trim();
      continue;
    }

    if (!recipe.servings) {
      const servings = extractServingsFromLine(line);
      if (servings) {
        recipe.servings = servings;
        continue;
      }
    }

    const lowerLine = line.toLowerCase();
    if (!recipe.prepTime && /(aktiivinen aika|valmisteluaika|prep)/i.test(lowerLine)) {
      recipe.prepTime = extractTimeValue(line);
      continue;
    }

    if (!recipe.cookTime && /(passiivinen aika|kypsennys|paistoaika|paisto|cook)/i.test(lowerLine)) {
      recipe.cookTime = extractTimeValue(line);
      continue;
    }

    if (!recipe.totalTime && /(kokonaisaika|kokonaisvalmistusaika|yhteensä|yhteensa)/i.test(lowerLine)) {
      recipe.totalTime = extractTimeValue(line);
      continue;
    }

    if (currentSection === "ingredients" && /^\d+[.)]\s+/.test(line)) {
      currentSection = "instructions";
    } else if (!currentSection && lineStartsWithAmount(line)) {
      currentSection = "ingredients";
    } else if (!currentSection && /^\d+[.)]\s+/.test(line)) {
      currentSection = "instructions";
    }

    if (currentSection) {
      buckets[currentSection].push(line);
    } else if (recipe.title) {
      buckets.notes.push(line);
    }
  }

  recipe.title = recipe.title || "Tuotu resepti";
  recipe.ingredients = buckets.ingredients.join("\n");
  recipe.instructions = buckets.instructions.join("\n");
  recipe.notes = buckets.notes.join("\n");

  return normalizeRecipe(recipe);
}

export default function App() {
  const [recipes, setRecipes] = useState(loadRecipes);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState("view");
  const [draft, setDraft] = useState(emptyRecipe);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [backupDate, setBackupDate] = useState(getBackupDate);
  const [status, setStatus] = useState("");
  const importInputRef = useRef(null);
  const backupStatus = getBackupStatus(backupDate);
  const filtersActive = Boolean(searchTerm || categoryFilter || tagFilter || favoritesOnly);

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  useEffect(() => {
    if (mode !== "view") return;

    if (!selectedId && recipes.length > 0) {
      setSelectedId(recipes[0].id);
    }

    if (selectedId && !recipes.some((recipe) => recipe.id === selectedId)) {
      setSelectedId(recipes[0]?.id || "");
    }
  }, [recipes, selectedId, mode]);

  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedId);

  const categories = useMemo(
    () =>
      [...new Set(recipes.map((recipe) => recipe.category).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "fi")
      ),
    [recipes]
  );

  const tags = useMemo(
    () =>
      [...new Set(recipes.flatMap((recipe) => recipe.tags).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "fi")
      ),
    [recipes]
  );

  const filteredRecipes = useMemo(
    () =>
      recipes.filter((recipe) =>
        recipeMatches(recipe, searchTerm, categoryFilter, tagFilter, favoritesOnly)
      ),
    [recipes, searchTerm, categoryFilter, tagFilter, favoritesOnly]
  );

  const recipeGroups = useMemo(() => {
    const groupsByCategory = new Map();

    filteredRecipes.forEach((recipe) => {
      const category = getCategoryLabel(recipe);
      if (!groupsByCategory.has(category)) {
        groupsByCategory.set(category, []);
      }

      groupsByCategory.get(category).push(recipe);
    });

    return [...groupsByCategory.entries()]
      .map(([category, groupRecipes]) => ({
        category,
        recipes: groupRecipes.sort((a, b) => compareFinnish(a.title, b.title)),
      }))
      .sort((a, b) => {
        if (a.category === "Ilman kategoriaa") return 1;
        if (b.category === "Ilman kategoriaa") return -1;
        return compareFinnish(a.category, b.category);
      });
  }, [filteredRecipes]);

  function startNewRecipe() {
    setDraft(emptyRecipe());
    setMode("form");
    setSelectedId("");
    setStatus("");
  }

  function startTextImport() {
    setMode("textImport");
    setSelectedId("");
    setStatus("");
  }

  function startEditRecipe(recipe) {
    setDraft({ ...recipe, tags: [...recipe.tags] });
    setMode("form");
    setSelectedId(recipe.id);
    setStatus("");
  }

  function cancelForm() {
    setMode("view");
    setDraft(emptyRecipe());
  }

  function clearFilters() {
    setSearchTerm("");
    setCategoryFilter("");
    setTagFilter("");
    setFavoritesOnly(false);
  }

  function useImportedTextRecipe(importedRecipe) {
    setDraft(importedRecipe);
    setSelectedId("");
    setMode("form");
    setStatus("Tarkista tuotu resepti ja tallenna se.");
  }

  function saveDraft(event) {
    event.preventDefault();

    const now = new Date().toISOString();
    const cleanDraft = normalizeRecipe({
      ...draft,
      title: draft.title.trim(),
      category: draft.category.trim(),
      tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
      updatedAt: now,
      createdAt: draft.createdAt || now,
    });

    if (!cleanDraft.title) {
      setStatus("Anna reseptille nimi ennen tallennusta.");
      return;
    }

    setRecipes((currentRecipes) => {
      const exists = currentRecipes.some((recipe) => recipe.id === cleanDraft.id);
      if (exists) {
        return currentRecipes.map((recipe) => (recipe.id === cleanDraft.id ? cleanDraft : recipe));
      }

      return [cleanDraft, ...currentRecipes];
    });

    setSelectedId(cleanDraft.id);
    setMode("view");
    setStatus("Resepti tallennettu.");
  }

  function deleteRecipe(recipe) {
    const ok = window.confirm(`Poistetaanko resepti "${recipe.title}"?`);
    if (!ok) return;

    setRecipes((currentRecipes) => currentRecipes.filter((item) => item.id !== recipe.id));
    setMode("view");
    setStatus("Resepti poistettu.");
  }

  function toggleFavorite(recipe) {
    const now = new Date().toISOString();

    setRecipes((currentRecipes) =>
      currentRecipes.map((item) =>
        item.id === recipe.id ? { ...item, favorite: !item.favorite, updatedAt: now } : item
      )
    );
  }

  function exportBackup() {
    const exportedAt = new Date().toISOString();
    const payload = {
      app: "ReseptiApp",
      version: APP_VERSION,
      exportedAt,
      recipes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reseptiapp-varmuuskopio-${exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    window.localStorage.setItem(BACKUP_KEY, exportedAt);
    setBackupDate(exportedAt);
    setStatus("Varmuuskopio ladattu JSON-tiedostona.");
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (recipes.length >= IMPORT_WARNING_RECIPE_COUNT) {
        const continueImport = window.confirm(
          `Sovelluksessa on jo ${recipes.length} reseptiä. ` +
            "Ota varmuuskopio ennen tuontia. Jatketaanko tuontia?"
        );

        if (!continueImport) return;
      }

      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedRecipes = parseImportedRecipes(parsed);

      if (importedRecipes.length === 0) {
        setStatus("Tiedostosta ei löytynyt reseptejä.");
        return;
      }

      const existingIds = new Set(recipes.map((recipe) => recipe.id));
      const conflictCount = importedRecipes.filter((recipe) => existingIds.has(recipe.id)).length;
      let overwriteConflicts = false;

      if (conflictCount > 0) {
        overwriteConflicts = window.confirm(
          `Tiedostossa on ${conflictCount} reseptiä, jotka ovat jo sovelluksessa. ` +
            "OK korvaa nämä reseptit. Peruuta tuo vain uudet reseptit."
        );
      }

      const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
      let added = 0;
      let replaced = 0;

      importedRecipes.forEach((recipe) => {
        const exists = byId.has(recipe.id);
        if (exists && !overwriteConflicts) return;

        byId.set(recipe.id, recipe);
        if (exists) {
          replaced += 1;
        } else {
          added += 1;
        }
      });

      setRecipes([...byId.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      setStatus(`Tuonti valmis. Lisätty ${added}, korvattu ${replaced}.`);
    } catch (error) {
      console.error("Varmuuskopion tuonti epäonnistui", error);
      setStatus("Varmuuskopion tuonti epäonnistui. Tarkista JSON-tiedosto.");
    } finally {
      event.target.value = "";
    }
  }

  function parseImportedRecipes(parsed) {
    const source = Array.isArray(parsed) ? parsed : parsed?.recipes;
    if (!Array.isArray(source)) return [];

    const byId = new Map();
    source.forEach((recipe) => {
      const normalized = normalizeRecipe(recipe);
      byId.set(normalized.id, normalized);
    });

    return [...byId.values()];
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Omat reseptit</p>
          <h1>ReseptiApp</h1>
        </div>
        <span className="version">Versio {APP_VERSION}</span>
      </header>

      <section
        className={`backup-bar ${backupStatus.stale ? "backup-bar-warning" : ""}`}
        aria-label="Varmuuskopiot"
      >
        <div>
          <strong>Muista ottaa varmuuskopio säännöllisesti.</strong>
          <p>
            Viimeisin varmuuskopio:{" "}
            {backupDate ? formatDateTime(backupDate) : "ei vielä merkitty"}
          </p>
          {backupStatus.message && <p className="backup-warning-text">{backupStatus.message}</p>}
        </div>
        <div className="backup-actions">
          <button
            className="secondary-button"
            type="button"
            aria-label="Export backup"
            onClick={exportBackup}
          >
            Vie varmuuskopio
          </button>
          <button
            className="secondary-button"
            type="button"
            aria-label="Import backup"
            onClick={() => importInputRef.current?.click()}
          >
            Tuo varmuuskopio
          </button>
          <input
            ref={importInputRef}
            className="hidden-input"
            type="file"
            accept="application/json,.json"
            onChange={importBackup}
          />
        </div>
      </section>

      {status && <p className="status-message">{status}</p>}

      <main className="workspace">
        <aside className="recipe-list-panel" aria-label="Reseptilista">
          <div className="list-heading">
            <div>
              <h2>Reseptit</h2>
              <p>{recipes.length} tallennettua</p>
            </div>
            <div className="list-actions">
              <button className="secondary-button" type="button" onClick={startTextImport}>
                Tuo tekstistä
              </button>
              <button className="primary-button" type="button" onClick={startNewRecipe}>
                Uusi resepti
              </button>
            </div>
          </div>

          <div className="filters">
            <label>
              Haku
              <input
                type="search"
                placeholder="Nimi, raaka-aine, kategoria tai tagi"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <label>
              Kategoria
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">Kaikki kategoriat</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tagi
              <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                <option value="">Kaikki tagit</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={(event) => setFavoritesOnly(event.target.checked)}
              />
              Vain suosikit
            </label>
            <button
              className="secondary-button filter-clear-button"
              type="button"
              onClick={clearFilters}
              disabled={!filtersActive}
            >
              Tyhjennä haku
            </button>
          </div>

          <div className="recipe-list">
            {filteredRecipes.length === 0 && (
              <div className="empty-state">
                <p>Ei reseptejä tällä haulla.</p>
              </div>
            )}

            {recipeGroups.map((group) => (
              <section className="recipe-group" key={group.category}>
                <h3 className="recipe-group-title">
                  <span>{group.category}</span>
                  <span>{group.recipes.length}</span>
                </h3>
                {group.recipes.map((recipe) => (
                  <button
                    className={`recipe-card ${selectedId === recipe.id ? "is-selected" : ""}`}
                    type="button"
                    key={recipe.id}
                    onClick={() => {
                      setSelectedId(recipe.id);
                      setMode("view");
                    }}
                  >
                    <span className="recipe-card-title">{recipe.title}</span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </aside>

        <section className="detail-panel" aria-label="Resepti">
          {mode === "form" ? (
            <RecipeForm
              draft={draft}
              setDraft={setDraft}
              isEditing={Boolean(selectedId)}
              categories={categories}
              onSave={saveDraft}
              onCancel={cancelForm}
              setStatus={setStatus}
            />
          ) : mode === "textImport" ? (
            <RecipeTextImport onImport={useImportedTextRecipe} onCancel={cancelForm} />
          ) : selectedRecipe ? (
            <RecipeView
              recipe={selectedRecipe}
              onEdit={() => startEditRecipe(selectedRecipe)}
              onDelete={() => deleteRecipe(selectedRecipe)}
              onFavorite={() => toggleFavorite(selectedRecipe)}
            />
          ) : (
            <div className="empty-detail">
              <h2>Aloita lisäämällä resepti</h2>
              <button className="primary-button" type="button" onClick={startNewRecipe}>
                Uusi resepti
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function RecipeTextImport({ onImport, onCancel }) {
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState("");

  function handleImport(event) {
    event.preventDefault();

    if (rawText.trim().length < 20) {
      setError("Liitä ensin reseptin teksti.");
      return;
    }

    const importedRecipe = parseRecipeFromText(rawText, sourceUrl);
    onImport(importedRecipe);
  }

  return (
    <form className="text-import-form" onSubmit={handleImport}>
      <div className="form-title-row">
        <div>
          <p className="eyebrow">Tuonti</p>
          <h2>Tuo resepti tekstistä</h2>
        </div>
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Peruuta
          </button>
          <button className="primary-button" type="submit">
            Jäsennä resepti
          </button>
        </div>
      </div>

      <label>
        Reseptin teksti
        <span className="field-help">
          Siivoa teksti ensin esimerkiksi Muistiossa ja liitä se tänne otsikoiden avulla.
        </span>
        <textarea
          rows="18"
          value={rawText}
          onChange={(event) => {
            setRawText(event.target.value);
            setError("");
          }}
          placeholder={RECIPE_TEXT_TEMPLATE}
        />
      </label>

      <label>
        Lähdelinkki
        <input
          type="url"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://..."
        />
      </label>

      {error && <p className="status-message">{error}</p>}
    </form>
  );
}

function RecipeView({ recipe, onEdit, onDelete, onFavorite }) {
  const baseServings = parseServings(recipe.servings);
  const [targetServings, setTargetServings] = useState(baseServings ? String(baseServings) : "");
  const targetServingsNumber = parsePositiveNumber(targetServings);
  const scalingFactor = baseServings && targetServingsNumber ? targetServingsNumber / baseServings : 1;
  const scaledIngredients = scaleIngredientText(recipe.ingredients, scalingFactor);
  const scaledInstructions = scaleInstructionText(recipe.instructions, scalingFactor);

  useEffect(() => {
    setTargetServings(baseServings ? String(baseServings) : "");
  }, [recipe.id, recipe.servings, baseServings]);

  return (
    <article className="recipe-view">
      <div className="recipe-actions no-print">
        <button className="secondary-button" type="button" onClick={onFavorite}>
          {recipe.favorite ? "Poista suosikeista" : "Lisää suosikiksi"}
        </button>
        <button className="secondary-button" type="button" onClick={onEdit}>
          Muokkaa
        </button>
        <button className="danger-button" type="button" onClick={onDelete}>
          Poista
        </button>
        <button className="secondary-button" type="button" onClick={() => window.print()}>
          Tulosta
        </button>
      </div>

      {recipe.image && <img className="recipe-image" src={recipe.image} alt="" />}

      <div className="recipe-title-row">
        <div>
          <p className="eyebrow">{recipe.category || "Ei kategoriaa"}</p>
          <h2>{recipe.title}</h2>
        </div>
        {recipe.favorite && <span className="favorite-mark">★ Suosikki</span>}
      </div>

      <div className="quick-facts">
        <Fact label="Annoksia" value={recipe.servings} />
        <Fact label="Aktiivinen aika" value={recipe.prepTime} />
        <Fact label="Passiivinen aika" value={recipe.cookTime} />
        <Fact label="Kokonaisaika" value={recipe.totalTime} />
      </div>

      {recipe.tags.length > 0 && (
        <div className="tag-row large">
          {recipe.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <section className="recipe-section">
        <div className="section-title-row">
          <h3>Raaka-aineet</h3>
          {baseServings && (
            <label className="serving-adjuster no-print">
              Annokset nyt
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={targetServings}
                onChange={(event) => setTargetServings(event.target.value)}
              />
            </label>
          )}
        </div>
        <RecipeText value={scaledIngredients || "Ei raaka-aineita."} />
      </section>

      <section className="recipe-section">
        <h3>Ohjeet</h3>
        <RecipeText value={scaledInstructions || "Ei ohjeita."} />
      </section>

      {recipe.notes && (
        <section className="recipe-section">
          <h3>Muistiinpanot</h3>
          <RecipeText value={recipe.notes} />
        </section>
      )}

      {recipe.sourceUrl && (
        <section className="recipe-section no-print">
          <h3>Lähde</h3>
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            {recipe.sourceUrl}
          </a>
        </section>
      )}

      <p className="updated-at">Päivitetty {formatDateTime(recipe.updatedAt)}</p>
    </article>
  );
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function RecipeText({ value }) {
  const blocks = createTextBlocks(value);

  return (
    <div className="formatted-text">
      {blocks.map((block, blockIndex) => {
        if (block.type === "ordered") {
          return (
            <ol key={blockIndex} start={block.start}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <RichText value={item} />
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul key={blockIndex}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <RichText value={item} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex}>
            <RichText value={block.text} />
          </p>
        );
      })}
    </div>
  );
}

function RichText({ value }) {
  return (
    <span className="preline">
      {parseBoldText(value).map((part, index) =>
        part.bold ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>
      )}
    </span>
  );
}

function parseBoldText(value) {
  const parts = [];
  const text = String(value || "");
  const matcher = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = matcher.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    }

    parts.push({ text: match[1], bold: true });
    lastIndex = matcher.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), bold: false });
  }

  return parts.length > 0 ? parts : [{ text, bold: false }];
}

function createTextBlocks(value) {
  const lines = String(value || "").split(/\r?\n/);
  const blocks = [];
  let paragraphLines = [];
  let currentList = null;

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
    paragraphLines = [];
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      currentList = null;
      return;
    }

    const numbered = rawLine.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();

      if (!currentList || currentList.type !== "ordered") {
        currentList = {
          type: "ordered",
          start: Number(numbered[1]),
          items: [],
        };
        blocks.push(currentList);
      }

      currentList.items.push(numbered[2].trim());
      return;
    }

    const bulleted = rawLine.match(/^\s*[-*]\s+(.*)$/);
    if (bulleted) {
      flushParagraph();

      if (!currentList || currentList.type !== "unordered") {
        currentList = { type: "unordered", items: [] };
        blocks.push(currentList);
      }

      currentList.items.push(bulleted[1].trim());
      return;
    }

    if (currentList && currentList.items.length > 0) {
      const lastIndex = currentList.items.length - 1;
      currentList.items[lastIndex] = `${currentList.items[lastIndex]}\n${line}`;
      return;
    }

    paragraphLines.push(line);
  });

  flushParagraph();
  return blocks;
}

function RecipeForm({ draft, setDraft, isEditing, categories, onSave, onCancel, setStatus }) {
  const [imageStatus, setImageStatus] = useState("");
  const [tagsText, setTagsText] = useState(draft.tags.join(", "));

  useEffect(() => {
    setTagsText(draft.tags.join(", "));
  }, [draft.id]);

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateTags(value) {
    setTagsText(value);
    updateField("tags", splitTags(value));
  }

  async function saveImageFromBlob(blob, successMessage) {
    setImageStatus("Kuvaa pienennetään...");

    try {
      const imageFile =
        blob instanceof File
          ? blob
          : new File([blob], "liitetty-kuva", { type: blob.type || "image/png" });
      const resizedImage = await resizeRecipeImage(imageFile);
      updateField("image", resizedImage);
      setImageStatus(successMessage);
      setStatus("");
    } catch (error) {
      console.error("Kuvan käsittely epäonnistui", error);
      setImageStatus("");
      setStatus("Kuvan lisääminen epäonnistui.");
    }
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    await saveImageFromBlob(file, "Kuva lisätty.");
    event.target.value = "";
  }

  async function pasteImageFromClipboard() {
    try {
      if (!navigator.clipboard?.read) {
        setStatus("Selaimesi ei salli kuvan lukemista leikepöydältä. Kokeile Ctrl+V kuvan kohdalla.");
        return;
      }

      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const imageBlob = await item.getType(imageType);
          await saveImageFromBlob(imageBlob, "Kuva liitetty leikepöydältä.");
          return;
        }
      }

      setStatus("Leikepöydältä ei löytynyt kuvaa.");
    } catch (error) {
      console.error("Kuvan liittäminen epäonnistui", error);
      setImageStatus("");
      setStatus("Kuvan liittäminen ei onnistunut. Kopioi varsinainen kuva tai lisää se tiedostona.");
    }
  }

  function handleImagePaste(event) {
    const files = [...(event.clipboardData?.files || [])];
    const pastedImage = files.find((file) => file.type.startsWith("image/"));
    if (!pastedImage) return;

    event.preventDefault();
    saveImageFromBlob(pastedImage, "Kuva liitetty leikepöydältä.");
  }

  return (
    <form className="recipe-form" onSubmit={onSave}>
      <div className="form-title-row">
        <div>
          <p className="eyebrow">Resepti</p>
          <h2>{isEditing ? "Muokkaa reseptiä" : "Uusi resepti"}</h2>
        </div>
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Peruuta
          </button>
          <button className="primary-button" type="submit">
            Tallenna
          </button>
        </div>
      </div>

      <div className="form-grid">
        <label className="wide">
          Nimi
          <input
            required
            value={draft.title}
            onChange={(event) => updateField("title", event.target.value)}
          />
        </label>

        <label>
          Kategoria
          <input
            list="recipe-categories"
            value={draft.category}
            onChange={(event) => updateField("category", event.target.value)}
          />
          <datalist id="recipe-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>

        <label>
          Tagit
          <input
            placeholder="arki, nopea, kasvis"
            value={tagsText}
            onChange={(event) => updateTags(event.target.value)}
          />
        </label>

        <label>
          Annokset
          <input
            value={draft.servings}
            onChange={(event) => updateField("servings", event.target.value)}
          />
        </label>

        <label>
          Aktiivinen aika
          <input
            value={draft.prepTime}
            onChange={(event) => updateField("prepTime", event.target.value)}
          />
        </label>

        <label>
          Passiivinen aika
          <input
            value={draft.cookTime}
            onChange={(event) => updateField("cookTime", event.target.value)}
          />
        </label>

        <label>
          Kokonaisaika
          <input
            value={draft.totalTime}
            onChange={(event) => updateField("totalTime", event.target.value)}
          />
        </label>

        <label className="wide">
          Lähdelinkki
          <input
            type="url"
            value={draft.sourceUrl}
            onChange={(event) => updateField("sourceUrl", event.target.value)}
          />
        </label>

        <label className="wide">
          Raaka-aineet
          <textarea
            rows="7"
            value={draft.ingredients}
            onChange={(event) => updateField("ingredients", event.target.value)}
          />
        </label>

        <label className="wide">
          Ohjeet
          <textarea
            rows="9"
            value={draft.instructions}
            onChange={(event) => updateField("instructions", event.target.value)}
          />
        </label>

        <label className="wide">
          Muistiinpanot
          <textarea
            rows="4"
            value={draft.notes}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </label>
      </div>

      <section
        className="image-box"
        tabIndex="0"
        onPaste={handleImagePaste}
        aria-label="Reseptin kuva"
      >
        <div>
          <h3>Kuva</h3>
          <p>Kopioi kuva ja paina Liitä kuva, tai valitse kuva tiedostona.</p>
        </div>
        <div className="image-actions">
          <label className="file-button">
            Lisää kuva
            <input type="file" accept="image/*" onChange={handleImageChange} />
          </label>
          <button className="secondary-button" type="button" onClick={pasteImageFromClipboard}>
            Liitä kuva
          </button>
          {draft.image && (
            <button className="secondary-button" type="button" onClick={() => updateField("image", "")}>
              Poista kuva
            </button>
          )}
        </div>
        {imageStatus && <p className="image-status">{imageStatus}</p>}
        {draft.image && <img className="image-preview" src={draft.image} alt="" />}
      </section>
    </form>
  );
}
