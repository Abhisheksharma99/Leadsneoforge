#!/usr/bin/env python3
"""
Reddit Keyword Monitor for ForgeCadNeo
========================================
Standalone Python script that monitors Reddit for relevant posts
using the public JSON API (no API key required).

Usage:
    python3 monitor-reddit.py                  # Run once, print results
    python3 monitor-reddit.py --notify         # Run once, send desktop notification
    python3 monitor-reddit.py --email          # Run once, send email summary
    python3 monitor-reddit.py --daemon         # Run continuously every 6 hours

Cron setup (every 6 hours):
    0 */6 * * * cd /Users/abhisheksharma/work/forgecadneo/automation && python3 monitor-reddit.py --notify >> reddit-monitor.log 2>&1
"""

import json
import os
import sys
import time
import hashlib
import subprocess
import argparse
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from urllib.parse import quote_plus

# =============================================================================
# CONFIGURATION
# =============================================================================

KEYWORDS = [
    "2D to 3D",
    "STEP file",
    "convert drawing",
    "legacy drawings",
    "CAD conversion",
    "engineering drawing digitization",
    "digitize drawings",
    "paper drawings to CAD",
    "DXF to STEP",
    "2D drawing to 3D model",
    "scan to CAD",
    "drawing conversion",
    "convert blueprint",
    "old drawings",
    "paper to digital",
    "IGES conversion",
    "reverse engineering drawing",
]

SUBREDDITS = [
    "cad",
    "engineering",
    "SolidWorks",
    "mechanicalengineering",
    "3Dprinting",
    "manufacturing",
    "Fusion360",
    "AutoCAD",
    "Inventor",
    "CATIA",
]

# How far back to look (in hours)
MAX_POST_AGE_HOURS = 24

# Where to store results
SCRIPT_DIR = Path(__file__).parent.resolve()
MATCHES_FILE = SCRIPT_DIR / "reddit-matches.json"
SEEN_FILE = SCRIPT_DIR / ".reddit-seen-ids.json"

# User-Agent header (Reddit blocks requests without one)
USER_AGENT = "ForgeCadNeo-RedditMonitor/1.0 (compatible; Python script; +https://forgecadneo.com)"

# Email settings (optional — set via environment variables)
EMAIL_FROM = os.environ.get("REDDIT_MONITOR_EMAIL_FROM", "")
EMAIL_TO = os.environ.get("REDDIT_MONITOR_EMAIL_TO", "")
EMAIL_SMTP_HOST = os.environ.get("REDDIT_MONITOR_SMTP_HOST", "smtp.gmail.com")
EMAIL_SMTP_PORT = int(os.environ.get("REDDIT_MONITOR_SMTP_PORT", "587"))
EMAIL_SMTP_USER = os.environ.get("REDDIT_MONITOR_SMTP_USER", "")
EMAIL_SMTP_PASS = os.environ.get("REDDIT_MONITOR_SMTP_PASS", "")

# Rate limiting: seconds to wait between subreddit fetches
RATE_LIMIT_SECONDS = 2


# =============================================================================
# CORE FUNCTIONS
# =============================================================================

def fetch_subreddit_posts(subreddit: str, sort: str = "new", limit: int = 50) -> list:
    """Fetch recent posts from a subreddit using Reddit's public JSON API."""
    url = f"https://www.reddit.com/r/{subreddit}/{sort}.json?limit={limit}&raw_json=1"
    req = Request(url, headers={"User-Agent": USER_AGENT})

    try:
        with urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("data", {}).get("children", [])
    except HTTPError as e:
        if e.code == 429:
            print(f"  [RATE LIMITED] r/{subreddit} — waiting 60s and retrying...")
            time.sleep(60)
            try:
                with urlopen(req, timeout=15) as response:
                    data = json.loads(response.read().decode("utf-8"))
                    return data.get("data", {}).get("children", [])
            except Exception:
                return []
        print(f"  [ERROR] r/{subreddit}: HTTP {e.code}")
        return []
    except URLError as e:
        print(f"  [ERROR] r/{subreddit}: {e.reason}")
        return []
    except Exception as e:
        print(f"  [ERROR] r/{subreddit}: {e}")
        return []


def search_subreddit(subreddit: str, query: str, limit: int = 25) -> list:
    """Search a subreddit using Reddit's search JSON API."""
    encoded_query = quote_plus(query)
    url = (
        f"https://www.reddit.com/r/{subreddit}/search.json"
        f"?q={encoded_query}&restrict_sr=on&sort=new&t=day&limit={limit}&raw_json=1"
    )
    req = Request(url, headers={"User-Agent": USER_AGENT})

    try:
        with urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("data", {}).get("children", [])
    except Exception:
        return []


def matches_keywords(title: str, selftext: str, keywords: list) -> str | None:
    """Check if a post matches any keyword. Returns the matched keyword or None."""
    combined = (title + " " + selftext).lower()
    for keyword in keywords:
        if keyword.lower() in combined:
            return keyword
    return None


def load_seen_ids() -> set:
    """Load previously seen post IDs to avoid duplicate notifications."""
    if SEEN_FILE.exists():
        try:
            with open(SEEN_FILE, "r") as f:
                data = json.load(f)
                return set(data)
        except (json.JSONDecodeError, IOError):
            return set()
    return set()


def save_seen_ids(seen_ids: set):
    """Save seen post IDs. Keep only the last 5000 to prevent unbounded growth."""
    ids_list = list(seen_ids)[-5000:]
    with open(SEEN_FILE, "w") as f:
        json.dump(ids_list, f)


def load_matches() -> list:
    """Load existing match history."""
    if MATCHES_FILE.exists():
        try:
            with open(MATCHES_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_matches(matches: list):
    """Save match history, keeping the last 500 entries."""
    trimmed = matches[-500:]
    with open(MATCHES_FILE, "w") as f:
        json.dump(trimmed, f, indent=2)


def send_desktop_notification(title: str, message: str):
    """Send a macOS desktop notification using osascript."""
    try:
        # Escape quotes for AppleScript
        safe_title = title.replace('"', '\\"').replace("'", "\\'")
        safe_message = message.replace('"', '\\"').replace("'", "\\'")

        script = f'display notification "{safe_message}" with title "{safe_title}"'
        subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            timeout=5,
        )
    except Exception as e:
        print(f"  [WARN] Desktop notification failed: {e}")


def send_email_notification(subject: str, body: str):
    """Send an email notification via SMTP."""
    if not all([EMAIL_FROM, EMAIL_TO, EMAIL_SMTP_USER, EMAIL_SMTP_PASS]):
        print("  [WARN] Email not configured. Set environment variables:")
        print("    REDDIT_MONITOR_EMAIL_FROM, REDDIT_MONITOR_EMAIL_TO")
        print("    REDDIT_MONITOR_SMTP_USER, REDDIT_MONITOR_SMTP_PASS")
        return

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = EMAIL_TO

    try:
        with smtplib.SMTP(EMAIL_SMTP_HOST, EMAIL_SMTP_PORT) as server:
            server.starttls()
            server.login(EMAIL_SMTP_USER, EMAIL_SMTP_PASS)
            server.send_message(msg)
        print(f"  [OK] Email sent to {EMAIL_TO}")
    except Exception as e:
        print(f"  [ERROR] Failed to send email: {e}")


def format_match_report(matches: list) -> str:
    """Format matches into a readable report."""
    if not matches:
        return "No new matching posts found."

    lines = [
        f"Reddit Keyword Monitor — ForgeCadNeo",
        f"{'=' * 50}",
        f"Found {len(matches)} new matching post(s)",
        f"Scanned at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
    ]

    for i, m in enumerate(matches, 1):
        lines.extend([
            f"--- Match {i} ---",
            f"Subreddit:  r/{m['subreddit']}",
            f"Title:      {m['title']}",
            f"Author:     u/{m['author']}",
            f"Score:      {m['score']} | Comments: {m['num_comments']}",
            f"Keyword:    \"{m['matched_keyword']}\"",
            f"Age:        {m['hours_old']}h ago",
            f"URL:        {m['url']}",
            "",
        ])

        if m.get("selftext_preview"):
            preview = m["selftext_preview"][:200]
            lines.extend([f"Preview:    {preview}", ""])

    return "\n".join(lines)


# =============================================================================
# MAIN MONITOR FUNCTION
# =============================================================================

def run_monitor(notify: bool = False, email: bool = False) -> list:
    """
    Main monitoring function. Scans all subreddits for keyword matches.
    Returns list of new matches found.
    """
    print(f"\n{'=' * 60}")
    print(f"ForgeCadNeo Reddit Monitor")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Keywords: {len(KEYWORDS)} | Subreddits: {len(SUBREDDITS)}")
    print(f"{'=' * 60}\n")

    seen_ids = load_seen_ids()
    existing_matches = load_matches()
    new_matches = []
    now_ts = time.time()

    for subreddit in SUBREDDITS:
        print(f"Scanning r/{subreddit}...")

        # Method 1: Fetch new posts
        posts = fetch_subreddit_posts(subreddit)
        time.sleep(RATE_LIMIT_SECONDS)

        # Method 2: Also search for key phrases
        for search_term in ["2D to 3D", "STEP file", "CAD conversion", "legacy drawings"]:
            search_results = search_subreddit(subreddit, search_term)
            posts.extend(search_results)
            time.sleep(RATE_LIMIT_SECONDS)

        # Deduplicate within this subreddit batch
        post_ids_seen = set()
        for post_wrapper in posts:
            post = post_wrapper.get("data", {})
            post_id = post.get("id", "")

            if not post_id or post_id in post_ids_seen:
                continue
            post_ids_seen.add(post_id)

            # Skip if already seen in previous runs
            if post_id in seen_ids:
                continue

            # Check age
            created_utc = post.get("created_utc", 0)
            age_hours = (now_ts - created_utc) / 3600
            if age_hours > MAX_POST_AGE_HOURS:
                continue

            # Check keyword match
            title = post.get("title", "")
            selftext = post.get("selftext", "")
            matched_keyword = matches_keywords(title, selftext, KEYWORDS)

            if matched_keyword:
                match = {
                    "id": post_id,
                    "title": title,
                    "subreddit": post.get("subreddit", subreddit),
                    "url": f"https://www.reddit.com{post.get('permalink', '')}",
                    "author": post.get("author", "[deleted]"),
                    "score": post.get("score", 0),
                    "num_comments": post.get("num_comments", 0),
                    "selftext_preview": selftext[:300] if selftext else "",
                    "matched_keyword": matched_keyword,
                    "created_utc": created_utc,
                    "hours_old": round(age_hours, 1),
                    "found_at": datetime.now(timezone.utc).isoformat(),
                }
                new_matches.append(match)
                seen_ids.add(post_id)
                print(f"  [MATCH] \"{matched_keyword}\" — {title[:80]}")

        print(f"  Checked {len(post_ids_seen)} posts, "
              f"{sum(1 for m in new_matches if m['subreddit'] == subreddit)} matches\n")

    # Save results
    save_seen_ids(seen_ids)

    if new_matches:
        all_matches = existing_matches + new_matches
        save_matches(all_matches)

        report = format_match_report(new_matches)
        print(f"\n{report}")

        # Desktop notification
        if notify:
            send_desktop_notification(
                f"Reddit: {len(new_matches)} new matches",
                f"Found {len(new_matches)} posts matching ForgeCadNeo keywords. Check terminal for details."
            )

        # Email notification
        if email:
            send_email_notification(
                f"[ForgeCadNeo] Reddit Alert: {len(new_matches)} new matching posts",
                report,
            )
    else:
        print("\nNo new matching posts found this cycle.")

    print(f"\nTotal matches in history: {len(load_matches())}")
    print(f"Scan complete: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    return new_matches


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Monitor Reddit for ForgeCadNeo-relevant posts"
    )
    parser.add_argument(
        "--notify",
        action="store_true",
        help="Send macOS desktop notification on matches",
    )
    parser.add_argument(
        "--email",
        action="store_true",
        help="Send email notification on matches",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run continuously every 6 hours",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=6,
        help="Hours between scans in daemon mode (default: 6)",
    )
    args = parser.parse_args()

    if args.daemon:
        print(f"Running in daemon mode (every {args.interval} hours)")
        print("Press Ctrl+C to stop.\n")
        while True:
            try:
                run_monitor(notify=args.notify, email=args.email)
                print(f"\nSleeping {args.interval} hours until next scan...")
                time.sleep(args.interval * 3600)
            except KeyboardInterrupt:
                print("\nDaemon stopped.")
                sys.exit(0)
    else:
        matches = run_monitor(notify=args.notify, email=args.email)
        sys.exit(0 if matches else 1)


if __name__ == "__main__":
    main()
