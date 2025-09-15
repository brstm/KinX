/**
 * @file A command-line tool for exporting data and media from the Kindroid service.
 * @description This script authenticates using a Firebase refresh token, then provides an interactive menu
 * to export data for individual "Kins", "Group Chats", or the "Global Journal". It can also perform a
 * full-account backup, including all media files, with a single command.
 *
 * @version 1.3.0
 *
 * @requires Node.js v18+ (for native fetch)
 *
 * @env {string} KINDROID_REFRESH_TOKEN - For non-interactive use, the Firebase refresh token can be
 * provided via this environment variable to bypass the manual prompt.
 */

import { stdin as input, stdout as output } from 'node:process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// ================================================================================================
// --- CONFIGURATION ---
// ================================================================================================

const CONFIG = {
  // Firebase project details for Kindroid
  PROJECT_ID: 'kindroid-ai',
  FIREBASE_API_KEY: 'AIzaSyDaRrRxqBj5DZ78oGODq2RT0Cfww2U-F1A',

  // API pagination settings
  QUERY_PAGE_SIZE: 100, // Page size for paginated queries (e.g., chat messages)
  MAX_LIST_PAGE_SIZE: 300, // Max page size for listing top-level items like Kins/Groups

  // Output directory names
  KINS_PARENT_DIR: 'Kins',
  GROUPS_PARENT_DIR: 'Group Chats',
  GLOBAL_PARENT_DIR: 'Global Journal',
  SELFIES_SUBDIR: 'Selfies',
  VIDEO_SELFIES_SUBDIR: 'Video Selfies',

  // Media download settings
  DOWNLOAD_CONCURRENCY: 8, // Number of simultaneous media downloads

  // A user agent helps identify this script's traffic to the backend API.
  USER_AGENT: 'KinX-Exporter/1.3.0'
};

// ================================================================================================
// --- UI / CONSOLE HELPERS ---
// ================================================================================================

/**
 * A robust raw-mode input handler. This function takes direct control of the TTY
 * to provide a better user experience for interactive prompts, supporting masking
 * and the Escape key.
 * @param {string} promptText The prompt text to display.
 * @param {{mask: boolean}} [options={mask: false}] Options for the prompt.
 * @returns {Promise<{esc: boolean, value: string | null}>} An object with the result.
 */
function promptRaw(promptText, options = { mask: false }) {
    return new Promise((resolve) => {
        const stdin = input;
        const stdout = output;
        const wasRaw = stdin.isRaw;
        const buffer = [];

        const cleanup = () => {
            stdin.off('data', onData);
            if (!wasRaw) stdin.setRawMode(false);
            stdin.pause();
        };

        const onData = (key) => {
            const char = key.toString('utf8');
            switch (char) {
                case '\x03': // Ctrl+C
                    cleanup();
                    stdout.write('\nAborted.\n');
                    process.exit(130);
                    break;
                case '\x1b': // Escape key
                    cleanup();
                    stdout.write('\n');
                    resolve({ esc: true, value: null });
                    break;
                case '\r': // Enter key
                case '\n':
                    cleanup();
                    stdout.write('\n');
                    resolve({ esc: false, value: buffer.join('').trim() });
                    break;
                case '\x7f': // Backspace (macOS/Linux)
                case '\b': // Backspace (Windows)
                    if (buffer.length > 0) {
                        buffer.pop();
                        stdout.write('\b \b'); // Move cursor left, erase, move left again
                    }
                    break;
                default:
                    if (char >= ' ') {
                        buffer.push(char);
                        stdout.write(options.mask ? '*' : char);
                    }
                    break;
            }
        };

        stdout.write(promptText);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on('data', onData);
    });
}

/**
 * Prompts the user for sensitive input, masking it with asterisks.
 * @param {string} query The prompt text to display.
 * @returns {Promise<string|null>} The user's input, or null if they pressed Esc.
 */
async function promptMasked(query) {
    const { esc, value } = await promptRaw(query, { mask: true });
    return esc ? null : value;
}

/**
 * Prompts the user for a single line of input.
 * @param {string} promptText The prompt text to display.
 * @returns {Promise<{esc: boolean, value: string | null}>} An object indicating if Esc was pressed.
 */
async function promptLineOrEsc(promptText) {
    return promptRaw(promptText, { mask: false });
}

/**
 * Displays a menu of options and prompts the user for a selection.
 * @param {string} title The title of the menu.
 * @param {string[]} options An array of strings to display as menu options.
 * @param {string} [footer='Choose index (Esc to go back): '] The prompt text.
 * @returns {Promise<{esc: boolean, index: number}>} The selected index, or -1 for invalid input.
 */
async function askMenu(title, options, footer = 'Choose index (Esc to go back): ') {
    console.log(`\n--- ${title} ---`);
    options.forEach((opt, i) => console.log(`  [${i}] ${opt}`));
    const { esc, value } = await promptLineOrEsc(`\n${footer}`);
    if (esc) return { esc: true, index: -1 };

    const index = Number(value);
    if (value === '' || !Number.isInteger(index) || index < 0 || index >= options.length) {
        console.log('Invalid selection. Please try again.');
        return { esc: false, index: -1 };
    }
    return { esc: false, index };
}

/**
 * Asks a Yes/No question.
 * @param {string} question The question to ask.
 * @returns {Promise<boolean>} True for 'yes', false for 'no'.
 */
async function askYesNo(question) {
    while (true) {
        const { esc, value } = await promptLineOrEsc(`${question} [y/n]: `);
        if (esc) return false;
        const answer = value?.toLowerCase();
        if (answer === 'y' || answer === 'yes') return true;
        if (answer === 'n' || answer === 'no') return false;
    }
}

// ================================================================================================
// --- API & AUTHENTICATION ---
// ================================================================================================

/**
 * Refreshes a Firebase ID token using a refresh token.
 * @param {string} refreshToken The Firebase refresh token.
 * @returns {Promise<{id_token: string, user_id: string}>} The new ID token and user ID.
 */
async function refreshIdToken(refreshToken) {
  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(CONFIG.FIREBASE_API_KEY)}`;
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) {
    throw new Error(`Firebase Authentication failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/**
 * Creates the standard set of headers for Firestore API requests.
 * @param {string} idToken The Firebase ID token.
 * @returns {Record<string, string>} The headers object.
 */
const createHeaders = (idToken) => ({
  'Authorization': `Bearer ${idToken}`,
  'X-Goog-Api-Key': CONFIG.FIREBASE_API_KEY,
  'Content-Type': 'application/json',
  'User-Agent': CONFIG.USER_AGENT,
});

/**
 * A wrapper for making authenticated GET requests to the Firestore REST API.
 * @param {string} url The full URL to request.
 * @param {Record<string, string>} headers The request headers.
 * @returns {Promise<any>} The JSON response.
 */
async function httpGET(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP GET failed: ${response.status} ${await response.text()}`);
  return response.json();
}

/**
 * A wrapper for making authenticated POST requests to the Firestore REST API.
 * @param {string} url The full URL to request.
 * @param {Record<string, string>} headers The request headers.
 * @param {object} body The JSON body to send.
 * @returns {Promise<any>} The JSON response.
 */
async function httpPOST(url, headers, body) {
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`HTTP POST failed: ${response.status} ${await response.text()}`);
  return response.json();
}

/**
 * Constructs a base URL for a Firestore document or collection path.
 * @param {string} documentPath The path, e.g., "Users/some_uid/AIs".
 * @returns {string} The full Firestore API URL.
 */
const firestoreUrl = (documentPath) =>
  `https://firestore.googleapis.com/v1/projects/${CONFIG.PROJECT_ID}/databases/(default)/documents/${documentPath}`;


// ================================================================================================
// --- DECRYPTION & DATA DECODING ---
// ================================================================================================

/**
 * Derives an AES key and IV from a password and salt using an MD5-based KDF,
 * mimicking OpenSSL's `EVP_BytesToKey`.
 * @param {Buffer} passwordBuffer The password buffer.
 * @param {Buffer} salt The 8-byte salt.
 * @returns {{key: Buffer, iv: Buffer}} The derived 32-byte key and 16-byte IV.
 */
function evpBytesToKey(passwordBuffer, salt) {
  let derived = Buffer.alloc(0);
  let digest = Buffer.alloc(0);
  while (derived.length < 48) { // 32-byte key + 16-byte IV
    digest = crypto.createHash('md5').update(Buffer.concat([digest, passwordBuffer, salt])).digest();
    derived = Buffer.concat([derived, digest]);
  }
  return { key: derived.subarray(0, 32), iv: derived.subarray(32, 48) };
}

/**
 * Decrypts a base64-encoded string that uses the OpenSSL "Salted__" format with AES-256-CBC.
 * @param {string} opensslBase64 The base64-encoded ciphertext.
 * @param {string} uidPassword The password for decryption (user's UID).
 * @returns {string | null} The decrypted UTF-8 string, or null on failure.
 */
function decryptEncString(opensslBase64, uidPassword) {
  try {
    const raw = Buffer.from(opensslBase64, 'base64');
    if (raw.length < 16 || raw.slice(0, 8).toString('utf8') !== 'Salted__') return null;

    const salt = raw.slice(8, 16);
    const data = raw.slice(16);
    const { key, iv } = evpBytesToKey(Buffer.from(uidPassword, 'utf8'), salt);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    return null; // Return null to indicate failure
  }
}

/**
 * Recursively decodes a Firestore value object into a plain JavaScript type.
 * @param {object} firestoreValue The Firestore value object (e.g., { stringValue: 'hello' }).
 * @param {string} uid The user's ID, used as the password for decryption.
 * @returns {any} The decoded JavaScript value.
 */
function decodeValue(firestoreValue, uid) {
  if (firestoreValue == null || typeof firestoreValue !== 'object') return firestoreValue;

  const key = Object.keys(firestoreValue)[0];
  const value = firestoreValue[key];

  switch (key) {
    case 'stringValue':
      if (typeof value === 'string' && value.startsWith('!enc:')) {
        return decryptEncString(value.slice(5), uid) ?? value; // Fallback to original on failure
      }
      return value;
    case 'integerValue': return Number(value);
    case 'doubleValue': return Number(value);
    case 'booleanValue': return !!value;
    case 'timestampValue': return value;
    case 'nullValue': return null;
    case 'mapValue':
      const out = {};
      for (const [k, v] of Object.entries(value.fields || {})) {
        out[k] = decodeValue(v, uid);
      }
      return out;
    case 'arrayValue':
      return (value.values || []).map(v => decodeValue(v, uid));
    default:
      return firestoreValue;
  }
}

/**
 * Decodes all fields in a Firestore document.
 * @param {object} fields The 'fields' object from a Firestore document.
 * @param {string} uid The user's ID for decryption.
 * @returns {object} A plain JavaScript object with decoded values.
 */
function decodeFields(fields, uid) {
  const decoded = {};
  for (const [key, value] of Object.entries(fields || {})) {
    decoded[key] = decodeValue(value, uid);
  }
  return decoded;
}

// ================================================================================================
// --- FIRESTORE QUERY HELPERS ---
// ================================================================================================

/**
 * Extracts the document ID from its full resource name.
 * @param {{name: string}} doc The Firestore document object.
 * @returns {string} The document ID.
 */
const docId = (doc) => doc.name.split('/').pop();

/**
 * Strips the project/database prefix from a Firestore resource name.
 * @param {string} name The full resource name.
 * @returns {string} The simplified path.
 */
const stripDocPrefix = (name) => name.replace(/^projects\/[^/]+\/databases\/\(default\)\/documents\//, '');

/**
 * Fetches all documents from a collection by repeatedly calling the list endpoint.
 * @param {string} collectionPath The path to the collection (e.g., "Users/uid/AIs").
 * @param {Record<string, string>} headers The request headers.
 * @param {string} [orderByClause] An optional 'orderBy' string (e.g., "timestamp asc").
 * @returns {Promise<any[]>} An array of Firestore document objects.
 */
async function listAll(collectionPath, headers, orderByClause) {
  const documents = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ pageSize: String(CONFIG.MAX_LIST_PAGE_SIZE) });
    if (orderByClause) params.set('orderBy', orderByClause);
    if (pageToken) params.set('pageToken', pageToken);

    const url = `${firestoreUrl(collectionPath)}?${params.toString()}`;
    const response = await httpGET(url, headers);
    if (response.documents) {
      documents.push(...response.documents);
    }
    pageToken = response.nextPageToken || '';
  } while (pageToken);
  return documents;
}

/**
 * Gets the Firestore value object for a cursor based on a document and field name.
 * @param {object} doc The Firestore document.
 * @param {string} field The field name (or '__name__' for document reference).
 * @returns {object} The Firestore value object for the cursor.
 */
function valueForCursor(doc, field) {
  if (field === '__name__') return { referenceValue: doc.name };
  return doc.fields?.[field] || { nullValue: null };
}

/**
 * Executes a structured query to fetch all documents from a subcollection, handling pagination with cursors.
 * @param {string} parentDocPath Path to the parent document.
 * @param {string} collectionId The ID of the subcollection.
 * @param {Record<string, string>} headers Request headers.
 * @param {string} orderField The field to order results by.
 * @returns {Promise<any[]>} An array of Firestore document objects.
 */
async function runQueryAll(parentDocPath, collectionId, headers, orderField = 'timestamp') {
  const documents = [];
  let lastDoc = null;

  while (true) {
    const query = {
      structuredQuery: {
        from: [{ collectionId }],
        orderBy: [
          { field: { fieldPath: orderField }, direction: 'ASCENDING' },
          { field: { fieldPath: '__name__' }, direction: 'ASCENDING' } // Secondary sort for stable ordering
        ],
        limit: CONFIG.QUERY_PAGE_SIZE
      }
    };

    if (lastDoc) {
      query.structuredQuery.startAt = {
        values: [valueForCursor(lastDoc, orderField), valueForCursor(lastDoc, '__name__')],
        before: false // 'startAfter' behavior
      };
    }

    const rows = await httpPOST(`${firestoreUrl(parentDocPath)}:runQuery`, headers, query);
    const docsInPage = rows.map(r => r.document).filter(Boolean);

    if (docsInPage.length === 0) break;
    documents.push(...docsInPage);
    lastDoc = docsInPage[docsInPage.length - 1];
    if (docsInPage.length < CONFIG.QUERY_PAGE_SIZE) break;
  }
  return documents;
}

/**
 * A specialized query runner for journal entries, ordered by the 'created' field.
 * @param {object} params
 * @param {string} params.parentDocPath Path to the parent document.
 * @param {string} params.collectionId The collection ID (e.g., 'JournalV3').
 * @param {Record<string, string>} params.headers Request headers.
 * @returns {Promise<any[]>} An array of journal document objects.
 */
async function fetchJournalAll(params) {
  const { parentDocPath, collectionId, headers } = params;
  try {
    return await runQueryAll(parentDocPath, collectionId, headers, 'created');
  } catch (e) {
    if (String(e).includes('PERMISSION_DENIED') || String(e).includes('403')) {
      console.warn(`  - Query failed (permission denied), attempting fallback list method. This may be slower.`);
      return await listAll(`${parentDocPath}/${collectionId}`, headers, 'created asc,__name__ asc');
    }
    throw e;
  }
}

// ================================================================================================
// --- EXPORT & DOWNLOAD LOGIC ---
// ================================================================================================

/**
 * Packages raw Firestore documents into a cleaner, serializable format.
 * @param {any[]} docs Array of Firestore documents.
 * @param {string} uid The user's ID for decryption.
 * @returns {any[]} An array of packaged document objects.
 */
function packDocs(docs, uid) {
  return docs.map(doc => ({
    id: docId(doc),
    path: stripDocPrefix(doc.name),
    createTime: doc.createTime,
    updateTime: doc.updateTime,
    data: decodeFields(doc.fields || {}, uid)
  }));
}

/**
 * Writes an object to a JSON file, creating directories if needed.
 * @param {string} filePath The full path to the output file.
 * @param {object} object The JavaScript object to serialize.
 */
async function writeJSON(filePath, object) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(object, null, 2));
  console.log(`  → Wrote ${path.basename(filePath)}`);
}

/**
 * Sanitizes a string for use as a file or directory name.
 * @param {string} name The input string.
 * @returns {string} The sanitized string.
 */
const sanitize = (name) => String(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 150);

/**
 * Sorts an array of Firestore documents by their `createTime` property, oldest first.
 * @param {any[]} docs Array of Firestore documents.
 * @returns {any[]} The sorted array.
 */
function sortByCreateTimeAsc(docs) {
    return [...docs].sort((a, b) => {
        const timeA = new Date(a.createTime || 0).getTime();
        const timeB = new Date(b.createTime || 0).getTime();
        return timeA - timeB;
    });
}

/**
 * Extracts a clean <id>.<ext> filename from a URL.
 * @param {string} urlString The URL to parse.
 * @returns {string} A sanitized filename like "some_id.jpeg".
 */
function filenameFromUrl(urlString) {
    try {
        const url = new URL(urlString);
        const decoded = decodeURIComponent(url.pathname);
        const base = decoded.split('/').pop().split('\\').pop();

        const match = base.match(/(.+)\.([A-Za-z0-9]+)$/);
        if (!match) return base; // No extension, fallback to full base

        const [, stem, ext] = match;
        const id = stem.includes('_') ? stem.split('_').pop() : stem;
        return `${id}.${ext.toLowerCase()}`;
    } catch {
        return `download_${Date.now()}.bin`;
    }
}

/**
 * Downloads a list of media items concurrently.
 * @param {Array<{url: string, dest: string}>} items The items to download.
 */
async function downloadMedia(items) {
    if (items.length === 0) return;
    console.log(`\nStarting download of ${items.length} media file(s)...`);

    let completed = 0;
    let failed = 0;
    const total = items.length;
    let itemsToProcess = [...items]; // Create a copy to consume

    const updateProgress = () => {
        const percent = ((completed + failed) / total * 100).toFixed(1);
        output.clearLine(0);
        output.cursorTo(0);
        output.write(`  Progress: ${completed}/${total} downloaded, ${failed} failed (${percent}%)`);
        if (completed + failed === total) {
            output.write('\n');
        }
    };

    const worker = async () => {
        while (itemsToProcess.length > 0) {
            const item = itemsToProcess.pop();
            if (!item) continue;

            try {
                await fs.access(item.dest);
            } catch {
                try {
                    const response = await fetch(item.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    await fs.writeFile(item.dest, buffer);
                } catch (e) {
                    failed++;
                    console.warn(`\n  - Failed to download ${path.basename(item.dest)}: ${e.message}`);
                    updateProgress(); // Update progress on failure too
                    continue;
                }
            }
            completed++;
            updateProgress();
        }
    };

    updateProgress();
    const workers = Array.from({ length: Math.min(CONFIG.DOWNLOAD_CONCURRENCY, items.length) }, worker);
    await Promise.all(workers);

    console.log(`✓ Media download complete. Success: ${completed}, Failed: ${failed}.`);
}

/**
 * Fetches and exports all data related to a single Kin.
 * @param {string} uid The user ID.
 * @param {Record<string, string>} headers The request headers.
 * @param {{id: string, name: string}} kin The Kin object to export.
 * @param {{forceDownloadMedia: boolean}} [options] Export options.
 */
async function exportKin(uid, headers, kin, options = { forceDownloadMedia: false }) {
  const subfolder = sanitize(`${kin.name} (${kin.id})`);
  const outputDir = path.join(CONFIG.KINS_PARENT_DIR, subfolder);
  console.log(`\nExporting Kin "${kin.name}" to "${outputDir}"...`);

  const kinPath = `Users/${uid}/AIs/${kin.id}`;

  const profileDoc = await httpGET(firestoreUrl(kinPath), headers);
  await writeJSON(path.join(outputDir, 'profile.json'), packDocs([profileDoc], uid)[0]);

  let chatDocs;
  try {
      chatDocs = await runQueryAll(kinPath, 'ChatMessages', headers, 'timestamp');
  } catch (e) {
      console.warn(`  - Chat query failed, falling back to list method. Error: ${e.message}`);
      chatDocs = await listAll(`${kinPath}/ChatMessages`, headers, 'timestamp asc,__name__ asc');
  }
  await writeJSON(path.join(outputDir, 'chat_messages.json'), {
    count: chatDocs.length, items: packDocs(chatDocs, uid)
  });

  let pinnedDocs = await listAll(`${kinPath}/PinnedMessages`, headers);
  pinnedDocs = sortByCreateTimeAsc(pinnedDocs);
  await writeJSON(path.join(outputDir, 'pinned_messages.json'), {
    count: pinnedDocs.length, items: packDocs(pinnedDocs, uid)
  });

  const journalDocs = await fetchJournalAll({ parentDocPath: kinPath, collectionId: 'JournalV3', headers });
  await writeJSON(path.join(outputDir, 'journal.json'), {
    count: journalDocs.length, items: packDocs(journalDocs, uid)
  });

  const selfiesDocs = await listAll(`${kinPath}/Selfies`, headers, 'timestamp asc,__name__ asc');
  const packedSelfies = packDocs(selfiesDocs, uid);
  await writeJSON(path.join(outputDir, 'selfies.json'), {
    count: packedSelfies.length, items: packedSelfies
  });

  const videoSelfiesDocs = await listAll(`${kinPath}/VideoSelfies`, headers, 'timestamp asc,__name__ asc');
  const packedVideoSelfies = packDocs(videoSelfiesDocs, uid);
  await writeJSON(path.join(outputDir, 'video_selfies.json'), {
    count: packedVideoSelfies.length, items: packedVideoSelfies
  });

  console.log('✓ Kin JSON export complete.');

  // --- Integrated Media Download ---
  const doDownload = options.forceDownloadMedia || await askYesNo('Download all selfie and video media for this Kin?');
  if (doDownload) {
      const selfiesDir = path.join(outputDir, CONFIG.SELFIES_SUBDIR);
      await fs.mkdir(selfiesDir, { recursive: true });
      const selfiesToDownload = packedSelfies
          .map(s => s.data.url)
          .filter(Boolean)
          .map(url => ({ url, dest: path.join(selfiesDir, filenameFromUrl(url)) }));

      const videoSelfiesDir = path.join(outputDir, CONFIG.VIDEO_SELFIES_SUBDIR);
      await fs.mkdir(videoSelfiesDir, { recursive: true });
      const videosToDownload = packedVideoSelfies
          .map(v => v.data.video_url || v.data.url)
          .filter(Boolean)
          .map(url => ({ url, dest: path.join(videoSelfiesDir, filenameFromUrl(url)) }));

      await downloadMedia([...selfiesToDownload, ...videosToDownload]);
  }
}

/**
 * Fetches and exports all data related to a single Group Chat.
 * @param {string} uid The user ID.
 * @param {Record<string, string>} headers The request headers.
 * @param {{id: string, name: string}} group The Group object to export.
 */
async function exportGroup(uid, headers, group) {
  const subfolder = sanitize(`${group.name} (${group.id})`);
  const outputDir = path.join(CONFIG.GROUPS_PARENT_DIR, subfolder);
  console.log(`\nExporting Group "${group.name}" to "${outputDir}"...`);

  const groupPath = `Users/${uid}/Groups/${group.id}`;

  const profileDoc = await httpGET(firestoreUrl(groupPath), headers);
  await writeJSON(path.join(outputDir, 'profile.json'), packDocs([profileDoc], uid)[0]);

  let chatDocs;
  try {
    chatDocs = await runQueryAll(groupPath, 'ChatMessages', headers, 'timestamp');
  } catch (e) {
    console.warn(`  - Chat query failed, falling back to list method. Error: ${e.message}`);
    chatDocs = await listAll(`${groupPath}/ChatMessages`, headers, 'timestamp asc,__name__ asc');
  }
  await writeJSON(path.join(outputDir, 'chat_messages.json'), {
    count: chatDocs.length, items: packDocs(chatDocs, uid)
  });

  let pinnedDocs = await listAll(`${groupPath}/PinnedMessages`, headers);
  pinnedDocs = sortByCreateTimeAsc(pinnedDocs);
  await writeJSON(path.join(outputDir, 'pinned_messages.json'), {
    count: pinnedDocs.length, items: packDocs(pinnedDocs, uid)
  });

  console.log('✓ Group export complete.');
}

// ================================================================================================
// --- MENU HANDLERS ---
// ================================================================================================

async function handleKinsMenu(uid, headers) {
    console.log('\nFetching Kins list...');
    const aiList = await listAll(`Users/${uid}/AIs`, headers);
    let kins = (aiList || []).map(d => {
        const id = docId(d);
        const decoded = decodeFields(d.fields || {}, uid);
        return { id, name: decoded.ai_name || `Unnamed Kin (${id})` };
    });
    kins.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    if (kins.length === 0) {
        console.log('No Kins found.');
        return;
    }

    while (true) {
        const kinLabels = kins.map(k => `${k.name} (${k.id})`);
        const { esc, index } = await askMenu('Kins', kinLabels);
        if (esc) return;
        if (index === -1) continue;

        try {
            await exportKin(uid, headers, kins[index]);
        } catch (e) {
            console.error(`\n❌ Kin export failed: ${e?.message || e}`);
        }
    }
}

async function handleGroupsMenu(uid, headers) {
    console.log('\nFetching Group Chats list...');
    const groupList = await listAll(`Users/${uid}/Groups`, headers);
    let groups = (groupList || []).map(d => {
        const id = docId(d);
        const decoded = decodeFields(d.fields || {}, uid);
        const name = decoded.name || decoded.group_name || decoded.title || `Unnamed Group (${id})`;
        return { id, name };
    });
    groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    if (groups.length === 0) {
        console.log('No Group Chats found.');
        return;
    }

    while (true) {
        const groupLabels = groups.map(g => `${g.name} (${g.id})`);
        const { esc, index } = await askMenu('Group Chats', groupLabels);
        if (esc) return;
        if (index === -1) continue;

        try {
            await exportGroup(uid, headers, groups[index]);
        } catch (e) {
            console.error(`\n❌ Group export failed: ${e?.message || e}`);
        }
    }
}

async function handleGlobalJournalMenu(uid, headers) {
    const outputDir = CONFIG.GLOBAL_PARENT_DIR;
    console.log(`\nExporting Global Journal to "${outputDir}"...`);
    try {
        const journalDocs = await fetchJournalAll({
            parentDocPath: `Users/${uid}`,
            collectionId: 'GlobalJournalV3',
            headers
        });
        await writeJSON(path.join(outputDir, 'global_journal.json'), {
            count: journalDocs.length,
            items: packDocs(journalDocs, uid)
        });
        console.log('✓ Global Journal export complete.');
    } catch (e) {
        console.error(`\n❌ Global Journal export failed: ${e?.message || e}`);
    }
}

async function handleExportAll(uid, headers) {
    console.log('');
    const doContinue = await askYesNo(
        'This will download all content from your Kindroid account, including all media.\n  Continue?'
    );
    if (!doContinue) {
        console.log('Bulk export cancelled.');
        return;
    }

    console.log('\n--- Starting Full Account Export ---');

    // Export all Kins + Media
    console.log('\nFetching all Kins...');
    const aiList = await listAll(`Users/${uid}/AIs`, headers);
    const kins = (aiList || []).map(d => {
        const id = docId(d);
        const decoded = decodeFields(d.fields || {}, uid);
        return { id, name: decoded.ai_name || `Unnamed Kin (${id})` };
    });

    if (kins.length > 0) {
        for (const kin of kins) {
            try {
                await exportKin(uid, headers, kin, { forceDownloadMedia: true });
            } catch (e) {
                console.error(`\n❌ Kin export failed for ${kin.name}: ${e?.message || e}`);
            }
        }
    } else {
        console.log('No Kins found to export.');
    }

    // Export all Group Chats
    console.log('\nFetching all Group Chats...');
    const groupList = await listAll(`Users/${uid}/Groups`, headers);
    const groups = (groupList || []).map(d => {
        const id = docId(d);
        const decoded = decodeFields(d.fields || {}, uid);
        return { id, name: decoded.name || decoded.group_name || decoded.title || `Unnamed Group (${id})` };
    });

    if (groups.length > 0) {
        for (const group of groups) {
            try {
                await exportGroup(uid, headers, group);
            } catch (e) {
                console.error(`\n❌ Group export failed for ${group.name}: ${e?.message || e}`);
            }
        }
    } else {
        console.log('No Group Chats found to export.');
    }

    // Export Global Journal
    await handleGlobalJournalMenu(uid, headers);

    console.log('\n--- ✓ Full Account Export Finished ---');
}


// ================================================================================================
// --- MAIN EXECUTION ---
// ================================================================================================

/**
 * Main application entry point.
 */
async function main() {
  console.clear();
  console.log('--- KinX - A Kindroid Exporter ---');

  let refreshToken = process.env.KINDROID_REFRESH_TOKEN;
  if (!refreshToken) {
      refreshToken = await promptMasked('Enter Firebase refresh token: ');
  }
  if (!refreshToken) throw new Error('No refresh token provided.');

  const { id_token, user_id } = await refreshIdToken(refreshToken);
  const headers = createHeaders(id_token);
  console.log(`✓ Authenticated successfully for user: ${user_id}`);

  const topMenuOptions = ['Kins', 'Group Chats', 'Global Journal', 'Export All'];

  while (true) {
    const { esc, index } = await askMenu('Sources', topMenuOptions, 'Choose source (Esc to exit): ');
    if (esc) break;
    if (index === -1) continue;

    const selection = topMenuOptions[index];
    switch (selection) {
        case 'Kins':
            await handleKinsMenu(user_id, headers);
            break;
        case 'Group Chats':
            await handleGroupsMenu(user_id, headers);
            break;
        case 'Global Journal':
            await handleGlobalJournalMenu(user_id, headers);
            break;
        case 'Export All':
            await handleExportAll(user_id, headers);
            // After a full export, return to the main menu
            break;
    }
  }
}

main().then(() => {
  console.log('\nExiting...');
}).catch((err) => {
  console.error(`\n\n❌ A critical error occurred: ${err.message}`);
  process.exit(1);
});
