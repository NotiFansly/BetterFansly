<div align="center">
  <img src="icons/betterfansly-full-logo.png" alt="BetterFansly Logo" width="500" />

  # BetterFansly

  **A power-user client modification for Fansly.**<br>
  *Part of the [NotiFansly](https://notifansly.xyz) Ecosystem.*

  <p>
    BetterFansly injects into the web interface to enhance your experience with robust theming, privacy features, analytics, and quality-of-life utilities.
  </p>
</div>

---

## Features

### Customization & Themes
*   **Catppuccin Integration:** Built-in support for all 4 flavors (Latte, Frappé, Macchiato, Mocha) with 14 selectable accent colors.
*   **Theme Engine:** Force dark/light modes or inject your own custom CSS.
*   **Remote Themes:** Load CSS stylesheets dynamically from external URLs (e.g., GitHub Gists).

### Privacy & Filtering
*   **Ghost Mode:** Read direct messages and view stories without sending "Seen" receipts to the creator.
*   **Keyword Muter:** Automatically hide posts from your feed that contain specific words or phrases.
*   **Client-Side Processing:** All filtering happens locally on your machine; no data is sent to third parties.

### Tools & Utilities
*   **Stream Miniplayer:** A persistent, draggable Picture-in-Picture video player. Watch streams or videos while browsing other pages. Includes transparency mode and auto-quality selection.
*   **Spending Tracker:** Visualize your spending habits. View total spend, a leaderboard of your top supported creators, and a yearly breakdown.
*   **Mutual Indicator:** Displays a "Follows You" badge next to usernames in the feed, comments, and profile headers.
*   **Account Migration:** Export your following list and subscriptions to a JSON file and import them to a new account automatically.

### Extensibility
*   **Plugin System:** Enable or disable core features individually.
*   **UserScripts:** Install custom JavaScript plugins directly from the UI settings.
*   **Developer Friendly:** Built on the Chrome UserScripts API for advanced DOM manipulation.

---

## Installation

1.  Download the latest release or clone this repository.
2.  Open Chrome/Edge/Brave and navigate to `chrome://extensions/`.
3.  Enable **Developer Mode** (toggle in the top right corner).
4.  Click **Load Unpacked**.
5.  Select the folder containing `manifest.json`.
6.  Visit [Fansly.com](https://fansly.com) and look for the **BetterFansly** button in the Settings menu or the sidebar.

---

## Usage

1.  Click the **BetterFansly** button in the sidebar (mobile/desktop) or the main Settings list.
2.  **Plugins Tab:** Toggle features like Ghost Mode, Miniplayer, or Mutual Indicator on/off.
3.  **Themes Tab:** Select a Catppuccin preset or paste your own CSS.
4.  **Tools Tab:** Access the Spending Tracker and Backup utilities.

---

## Privacy & Security

*   **Local Execution:** This extension runs entirely within your browser context.
*   **No Analytics:** We do not track your usage, clicks, or viewing habits.
*   **Direct API Calls:** The Spending Tracker and Backup tools communicate directly with Fansly's API using your active session. Your session token never leaves your browser.
*   **Open Source:** The code is unminified and transparent for auditing purposes.

*Warning: Only install custom plugins/scripts from sources you trust. Malicious scripts pasted into the Library tab can compromise your account security.*

---

## Roadmap

*   Community plugin repository
*   Advanced feed filtering (Media type, Date range)
*   Desktop notifications for specific creators
*   Export chat logs to text/html

---

## Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes.
4.  Open a Pull Request.

---

## Disclaimer

BetterFansly is a third-party modification and is **not** affiliated with, endorsed by, or connected to Fansly or Select Media LLC. Use at your own risk. This software is provided "as is" without warranty of any kind.

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**[GitHub](https://github.com/NotiFansly/BetterFansly) • [Discord](https://discord.gg/WXr8Zd2Js7) • [NotiFansly Bot](https://notifansly.xyz)**
