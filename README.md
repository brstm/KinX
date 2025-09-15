# **KinX \- A Kindroid Exporter**

**KinX** is a powerful, secure command-line tool for exporting all your data and media from the Kindroid service. It provides a complete, local backup of your Kin profiles, chat messages, journals, selfies, and videos.

The tool communicates directly with Kindroid's Firebase backend, just like the official app, to ensure a comprehensive and accurate data export. It features a user-friendly interactive menu for selecting what to export and handles the decryption of sensitive data locally on your machine.

## **Features**

* **Comprehensive Export:** Backs up Kins, Group Chats, and the Global Journal.  
* **Full Media Downloads:** After exporting a Kin's data, it can download all associated selfie images and videos to local folders.  
* **"Export All" Mode:** A powerful one-click option to back up your entire account—every Kin, Group, Journal, and all media—non-interactively.  
* **Complete Data:** For each Kin, it exports:  
  * Profile Data (backstory, key memories, etc.)  
  * Chat Messages  
  * Pinned Messages  
  * Journal Entries  
  * Selfies & Videos (metadata and media files)  
* **Secure & Private:** Your authentication token and decrypted data are never sent to any third-party server. All decryption happens locally.  
* **User-Friendly:** An interactive menu allows you to navigate and choose exactly what you want to export.  
* **Intelligent & Concurrent:** Uses efficient API queries to retrieve data and downloads media files in parallel for maximum speed.  
* **Readable Output:** All data is saved in neatly organized folders and human-readable JSON files.

## **Requirements**

* [Node.js](https://nodejs.org/) (version 18.x or higher is recommended)

## **Usage**

### **1\. Get the Script**

Download the kinx.mjs script to a folder on your computer.

### **2\. Find Your Firebase Refresh Token**

**⚠️ Warning:** The refresh token acts as a long-term password for your account. **Keep it secret and secure.**

1. Open Kindroid in a web browser (like Chrome or Firefox).  
2. Open the browser's **Developer Tools** (usually by pressing F12 or right-clicking the page and selecting "Inspect").  
3. Go to the **Application** tab (it might be called "Storage" in Firefox).  
4. On the left-hand side, find and expand the **IndexedDB** section. Select the firebaseLocalStorageDb option within it.  
5. A table will appear. Find the key that looks like firebase:authUser:AIza...:\[DEFAULT\]. Click on this row.  
6. A value panel will appear below or to the side. Inside this panel, you will see the value property, which contains a block of JSON text.  
7. Find the refreshToken property within that text and **carefully copy its entire value** (the long string inside the quotes).

### **3\. Run the Exporter**

Open your terminal or command prompt, navigate to the folder where you saved the script, and run it using one of the two methods below.

#### **Method A: Interactive Prompt (Recommended)**

node kinx.mjs

The script will securely prompt you to paste your Firebase refresh token. The token will be masked with asterisks (\*) and will not be saved in your shell history.

#### **Method B: Environment Variable (Advanced/Scripting)**

This method is more secure as it prevents the token from being saved in your shell history.

* **macOS/Linux:**  
  KINDROID\_REFRESH\_TOKEN="PASTE\_TOKEN\_HERE" node kinx.mjs

* **Windows (CMD):**  
  set KINDROID\_REFRESH\_TOKEN="PASTE\_TOKEN\_HERE" && node kinx.mjs

* **Windows (PowerShell):**  
  $env:KINDROID\_REFRESH\_TOKEN="PASTE\_TOKEN\_HERE"; node kinx.mjs

### **4\. Navigate the Menu**

Once authenticated, you will see the main menu:

\--- Sources \---  
  \[0\] Kins  
  \[1\] Group Chats  
  \[2\] Global Journal  
  \[3\] Export All

Choose source (Esc to exit):

* **Selective Export:** Choose options 0, 1, or 2 to browse and select individual items to export. After exporting a Kin, you'll be asked if you want to download its media.  
* **Full Backup:** Choose option 3 to export everything from your account, including all media. A confirmation prompt will appear before starting.  
* Press Esc at any time to go back or to exit from the main menu.

## **Output Structure**

The script will create a directory structure to store your exported data:

.  
├── Kins/  
│   └── Kin\_Name (kin\_id)/  
│       ├── Selfies/  
│       │   ├── image\_id\_1.jpg  
│       │   └── image\_id\_2.jpg  
│       ├── Video Selfies/  
│       │   └── video\_id\_1.mp4  
│       ├── profile.json  
│       ├── chat\_messages.json  
│       ├── journal.json  
│       ├── selfies.json  
│       └── video\_selfies.json  
│  
├── Group Chats/  
│   └── Group\_Name (group\_id)/  
│       ├── profile.json  
│       └── chat\_messages.json  
│  
└── Global Journal/  
    └── global\_journal.json

## **Security Warning**

Your Firebase Refresh Token provides complete access to your Kindroid account. **Treat it like a password.**

* Do not share it with anyone.  
* Do not commit it to a public Git repository.  
* Consider using the environment variable method for better security.

## **Disclaimer**

This is a third-party tool and is not affiliated with, endorsed, or supported by Kindroid. It is provided for personal use to help users back up their own data. **Use at your own risk.**