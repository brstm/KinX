# KinX - A Kindroid Exporter

KinX is a powerful, secure command-line tool for exporting all your data from the Kindroid service. It provides a complete, local backup of your Kin profiles, chat messages, journals, selfies metadata, and more.

The tool communicates directly with Kindroid's Firebase backend, just like the official app, to ensure a comprehensive and accurate data export. It features a user-friendly interactive menu for selecting what to export and handles the decryption of sensitive data locally on your machine.

-----

## Features

  * **Comprehensive Export:** Backs up Kins, Group Chats, and the Global Journal.
  * **Complete Data:** For each Kin, it exports:
      * Profile Data (backstory, avatar descriptions, etc.)
      * Chat Messages
      * Pinned Messages
      * Journal Entries
      * Selfies & Video Selfies metadata, including direct links to media
  * **Secure & Private:** Your authentication token and decrypted data are never sent to any third-party server. All decryption happens locally.
  * **User-Friendly:** An interactive menu allows you to navigate and choose exactly what you want to export.
  * **Intelligent Fetching:** Uses efficient API queries to retrieve data quickly and handles pagination for very long chat histories.
  * **Readable Output:** All data is saved in neatly organized folders and human-readable JSON files.

-----

## How It Works

The script authenticates with Kindroid's Firebase backend using a refresh token that you provide. This token allows the script to generate temporary ID tokens to securely access the Firestore database on your behalf.

It then navigates the database collections, downloads all data, and decodes it.

-----

## Requirements

  * Node.js (version 18.x or higher is recommended)

-----

## Usage

### 1\. Get the Script

Download the `kinx.mjs` script to a folder on your computer.

### 2\. Find Your Firebase Refresh Token

> **⚠️ Warning:** The refresh token acts as a long-term password for your account, so keep it secret.

1.  Open Kindroid in a web browser (like Chrome or Firefox).
2.  Open the browser's **Developer Tools**. You can usually do this by pressing `F12` or right-clicking the page and selecting "Inspect".
3.  Go to the **Application** tab (it might be called "Storage" in Firefox).
4.  On the left-hand side, find the **Local Storage** section and select the URL for the Kindroid app.
5.  In the filter box, type `firebase`.
6.  You will see a key that looks something like `firebase:authUser:AIza...:[DEFAULT]`. Click on it.
7.  In the value panel, you'll see a block of text. Find the property called `refreshToken` and copy its entire value (the long string inside the quotes).

### 3\. Run the Exporter

Open your terminal or command prompt, navigate to the folder where you saved the script, and run it using one of the two methods below.

#### Method A: Interactive Prompt (Recommended for ease of use)

Run the script with the following command:

```bash
node kinx.mjs
```

The script will securely prompt you to paste your Firebase refresh token. The token will be masked with asterisks (`*`) for security and will not be saved in your shell history.

#### Method B: Environment Variable (Recommended for security/scripting)

This method prevents the token from ever being in your shell history.

On macOS/Linux:

```bash
KINDROID_REFRESH_TOKEN="PASTE_YOUR_TOKEN_HERE" node kinx.mjs
```

On Windows (Command Prompt):

```bash
set KINDROID_REFRESH_TOKEN="PASTE_YOUR_TOKEN_HERE" && node kinx.mjs
```

On Windows (PowerShell):

```powershell
$env:KINDROID_REFRESH_TOKEN="PASTE_YOUR_TOKEN_HERE"; node kinx.mjs
```

### 4\. Navigate the Menu

Once authenticated, you will see the main menu:

```
--- Sources ---
  [0] Kins
  [1] Group Chats
  [2] Global Journal
```

Enter the number corresponding to your choice and press `Enter`.

To go back to the previous menu at any time, press the `Esc` key.

Pressing `Esc` at the main menu will exit the application.

-----

## Output Structure

The script will create a directory structure to store your exported data:

```
.
├── Kins/
│   └── Kin_Name (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)/
│       ├── profile.json
│       ├── chat_messages.json
│       ├── pinned_messages.json
│       ├── journal.json
│       ├── selfies.json
│       └── video_selfies.json
│
├── Group Chats/
│   └── Group_Name (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)/
│       ├── profile.json
│       ├── chat_messages.json
│       └── pinned_messages.json
│
└── Global Journal/
    └── global_journal.json
```

Each `.json` file contains a list of items with the original data, create/update times, and document IDs.

-----

## Security Warning

Your Firebase Refresh Token provides complete access to your Kindroid account. **Treat it like a password.**

  * Do not share it with anyone.
  * Do not commit it to a public Git repository.
  * Consider using the environment variable method for better security.

-----

## Disclaimer

This is a third-party tool and is not affiliated with, endorsed, or supported by Kindroid. It is provided for personal use to help users back up their own data. **Use at your own risk.**

Happy exporting\!
