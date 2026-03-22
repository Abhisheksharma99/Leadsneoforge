#!/usr/bin/env python3
"""
Reddit Reply Bot for ForgeCadNeo
==================================
Monitors target subreddits for posts matching keywords and generates
contextual, helpful replies using Claude AI. Replies are genuinely helpful
first, with subtle ForgeCadNeo mentions only when relevant.

Anti-spam safeguards:
    - Max N replies per day (configurable)
    - Minimum interval between replies (configurable)
    - Never replies to same user twice
    - Never replies to posts already mentioning ForgeCadNeo
    - Tracks replied post IDs to avoid duplicates
    - Rate limiting on both Reddit and Claude API sides

Usage:
    python reddit-reply-bot.py --dry-run --limit 5
    python reddit-reply-bot.py --dry-run --subreddit cad
    python reddit-reply-bot.py --daemon
    python reddit-reply-bot.py --once --limit 3
    python reddit-reply-bot.py --status

Cron setup (every 6 hours):
    0 */6 * * * cd /path/to/automation && python3 reddit-reply-bot.py --once --limit 3 >> reply-bot.log 2>&1

Environment variables required:
    REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
    ANTHROPIC_API_KEY
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()

# Import the Claude bot (same directory)
sys.path.insert(0, str(SCRIPT_DIR))

# Anti-spam defaults
MAX_REPLIES_PER_DAY = 10
MIN_REPLY_INTERVAL_SECONDS = 1800  # 30 minutes
MAX_POST_AGE_HOURS = 24
DAEMON_CHECK_INTERVAL_SECONDS = 1800  # 30 minutes

# File paths
REPLY_LOG_FILE = SCRIPT_DIR / "reply-log.json"
SEEN_FILE = SCRIPT_DIR / ".reddit-seen-ids.json"
REPLIED_USERS_FILE = SCRIPT_DIR / ".replied-users.json"

# Default keywords and subreddits
DEFAULT_KEYWORDS = [
    "2d to 3d",
    "step file",
    "legacy drawings",
    "cad conversion",
    "engineering drawing",
    "convert drawing",
    "stl viewer",
    "step viewer",
    "openscad",
    "paper drawings to cad",
    "digitize drawings",
    "dxf to step",
    "scan to cad",
    "drawing conversion",
    "convert blueprint",
]

DEFAULT_SUBREDDITS = [
    "cad",
    "mechanicalengineering",
    "3Dprinting",
    "SolidWorks",
    "engineering",
    "Fusion360",
    "manufacturing",
    "AutoCAD",
]

# Logger
logger = logging.getLogger("reddit-reply-bot")


# =============================================================================
# REDDIT CLIENT
# =============================================================================

def create_reddit_client():
    """Create and return an authenticated PRAW Reddit instance."""
    try:
        import praw
    except ImportError:
        logger.error("praw not installed. Run: pip install praw")
        sys.exit(1)

    client_id = os.environ.get("REDDIT_CLIENT_ID", "")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET", "")
    username = os.environ.get("REDDIT_USERNAME", "")
    password = os.environ.get("REDDIT_PASSWORD", "")
    user_agent = os.environ.get(
        "REDDIT_USER_AGENT",
        f"ForgeCadNeo Reply Bot v1.0 (by /u/{username})"
    )

    if not all([client_id, client_secret, username, password]):
        logger.error(
            "Reddit credentials not configured. Set environment variables:\n"
            "  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD"
        )
        sys.exit(1)

    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        username=username,
        password=password,
        user_agent=user_agent,
    )

    try:
        me = reddit.user.me()
        logger.info(f"Authenticated as u/{me.name}")
    except Exception as e:
        logger.error(f"Reddit authentication failed: {e}")
        sys.exit(1)

    return reddit


# =============================================================================
# STATE MANAGEMENT
# =============================================================================

def load_json_file(filepath: Path, default=None):
    """Load a JSON file, returning default on error."""
    if default is None:
        default = []
    if filepath.exists():
        try:
            with open(filepath, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return default
    return default


def save_json_file(filepath: Path, data):
    """Save data to a JSON file."""
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)


def load_reply_log() -> list[dict]:
    """Load the reply history log."""
    return load_json_file(REPLY_LOG_FILE, [])


def save_reply_log(log: list[dict]):
    """Save the reply history log (keep last 1000 entries)."""
    save_json_file(REPLY_LOG_FILE, log[-1000:])


def load_seen_ids() -> set:
    """Load previously seen post IDs."""
    data = load_json_file(SEEN_FILE, [])
    return set(data)


def save_seen_ids(seen_ids: set):
    """Save seen post IDs (keep last 5000)."""
    ids_list = list(seen_ids)[-5000:]
    save_json_file(SEEN_FILE, ids_list)


def load_replied_users() -> set:
    """Load the set of users we have already replied to."""
    data = load_json_file(REPLIED_USERS_FILE, [])
    return set(data)


def save_replied_users(users: set):
    """Save replied users set (keep last 2000)."""
    users_list = list(users)[-2000:]
    save_json_file(REPLIED_USERS_FILE, users_list)


def get_replies_today(log: list[dict]) -> int:
    """Count replies made today."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return sum(1 for entry in log if entry.get("replied_at", "").startswith(today))


def get_last_reply_time(log: list[dict]) -> Optional[datetime]:
    """Get the timestamp of the most recent reply."""
    if not log:
        return None
    try:
        return datetime.fromisoformat(log[-1]["replied_at"])
    except (KeyError, ValueError):
        return None


def can_reply(log: list[dict]) -> tuple[bool, str]:
    """Check if we can reply right now based on anti-spam limits."""
    today_count = get_replies_today(log)
    if today_count >= MAX_REPLIES_PER_DAY:
        return False, f"Daily limit reached ({today_count}/{MAX_REPLIES_PER_DAY} replies today)"

    last_time = get_last_reply_time(log)
    if last_time:
        elapsed = (datetime.now(timezone.utc) - last_time).total_seconds()
        if elapsed < MIN_REPLY_INTERVAL_SECONDS:
            remaining = int(MIN_REPLY_INTERVAL_SECONDS - elapsed)
            return False, f"Must wait {remaining}s before next reply"

    return True, "OK"


# =============================================================================
# POST SCANNING
# =============================================================================

def scan_subreddits(
    reddit,
    subreddits: list[str],
    keywords: list[str],
    limit_per_sub: int = 50,
    max_age_hours: float = MAX_POST_AGE_HOURS,
) -> list[dict]:
    """
    Scan subreddits for posts matching keywords.

    Args:
        reddit: Authenticated PRAW Reddit instance.
        subreddits: List of subreddit names to scan.
        keywords: List of keywords to match against.
        limit_per_sub: Max posts to fetch per subreddit.
        max_age_hours: Only consider posts newer than this.

    Returns:
        List of matching post dicts.
    """
    seen_ids = load_seen_ids()
    replied_users = load_replied_users()
    our_username = os.environ.get("REDDIT_USERNAME", "").lower()
    matches = []
    now_ts = time.time()

    for sub_name in subreddits:
        logger.info(f"Scanning r/{sub_name}...")

        try:
            subreddit = reddit.subreddit(sub_name)
            posts = list(subreddit.new(limit=limit_per_sub))
        except Exception as e:
            logger.warning(f"  Error fetching r/{sub_name}: {e}")
            continue

        sub_matches = 0
        for post in posts:
            post_id = post.id

            # Skip if already seen
            if post_id in seen_ids:
                continue

            # Mark as seen
            seen_ids.add(post_id)

            # Check age
            age_hours = (now_ts - post.created_utc) / 3600
            if age_hours > max_age_hours:
                continue

            # Skip our own posts
            author = str(post.author).lower() if post.author else "[deleted]"
            if author == our_username:
                continue

            # Skip posts from users we already replied to
            if author in replied_users:
                continue

            # Check if post already mentions ForgeCadNeo
            title = post.title or ""
            selftext = post.selftext or ""
            combined = (title + " " + selftext).lower()

            if "forgecadneo" in combined or "forge cad neo" in combined:
                continue

            # Check if any existing comment mentions ForgeCadNeo
            try:
                post.comments.replace_more(limit=0)
                has_our_reply = any(
                    "forgecadneo" in (c.body or "").lower()
                    for c in post.comments.list()
                )
                if has_our_reply:
                    continue
            except Exception:
                pass

            # Check keyword match
            matched_keyword = None
            for keyword in keywords:
                if keyword.lower() in combined:
                    matched_keyword = keyword
                    break

            if matched_keyword:
                match = {
                    "id": post_id,
                    "title": title,
                    "selftext": selftext[:2000],
                    "subreddit": sub_name,
                    "author": author,
                    "score": post.score,
                    "num_comments": post.num_comments,
                    "url": f"https://www.reddit.com{post.permalink}",
                    "matched_keyword": matched_keyword,
                    "age_hours": round(age_hours, 1),
                    "created_utc": post.created_utc,
                    "praw_submission": post,  # Keep reference for replying
                }
                matches.append(match)
                sub_matches += 1
                logger.info(f"  [MATCH] \"{matched_keyword}\" — {title[:80]}")

        logger.info(f"  Scanned {len(posts)} posts, {sub_matches} matches")
        time.sleep(2)  # Rate limit between subreddits

    save_seen_ids(seen_ids)
    logger.info(f"Total matches found: {len(matches)}")
    return matches


# =============================================================================
# REPLY GENERATION AND POSTING
# =============================================================================

def generate_reply(post: dict, bot) -> str:
    """
    Generate a contextual reply for a matched post using Claude.

    Args:
        post: The matched post dict.
        bot: ClaudeBot instance.

    Returns:
        Generated reply text.
    """
    return bot.generate_reddit_reply(
        post_title=post["title"],
        post_body=post["selftext"],
        subreddit=post["subreddit"],
    )


def submit_reply(
    post: dict,
    reply_text: str,
    dry_run: bool = False,
) -> dict:
    """
    Submit a reply to a Reddit post.

    Args:
        post: The matched post dict (must have 'praw_submission' key).
        reply_text: The reply text to post.
        dry_run: If True, log but do not post.

    Returns:
        Result dict with status and details.
    """
    result = {
        "post_id": post["id"],
        "post_title": post["title"][:100],
        "subreddit": post["subreddit"],
        "post_url": post["url"],
        "author": post["author"],
        "matched_keyword": post["matched_keyword"],
        "reply_text": reply_text[:500],
        "replied_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
    }

    if dry_run:
        logger.info(f"\n[DRY RUN] Would reply to r/{post['subreddit']}:")
        logger.info(f"  Post: {post['title'][:80]}")
        logger.info(f"  Author: u/{post['author']}")
        logger.info(f"  Keyword: \"{post['matched_keyword']}\"")
        logger.info(f"  URL: {post['url']}")
        logger.info(f"  Reply preview ({len(reply_text)} chars):")
        for line in reply_text.split("\n")[:6]:
            logger.info(f"    {line}")
        if reply_text.count("\n") > 6:
            logger.info(f"    ... ({reply_text.count(chr(10)) - 6} more lines)")
        result["status"] = "dry_run"
        return result

    try:
        submission = post.get("praw_submission")
        if submission is None:
            result["status"] = "error"
            result["error"] = "No PRAW submission object available"
            return result

        comment = submission.reply(reply_text)
        result["status"] = "posted"
        result["comment_id"] = comment.id
        result["comment_url"] = f"https://www.reddit.com{comment.permalink}"
        logger.info(f"[REPLIED] r/{post['subreddit']}: {post['title'][:60]}")
        logger.info(f"  Comment URL: {result['comment_url']}")

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        logger.error(f"[ERROR] Failed to reply: {e}")

    return result


# =============================================================================
# MAIN BOT LOGIC
# =============================================================================

def run_reply_bot(
    subreddits: Optional[list[str]] = None,
    keywords: Optional[list[str]] = None,
    limit: int = 5,
    dry_run: bool = False,
    use_quality_model: bool = False,
) -> list[dict]:
    """
    Main bot execution: scan, generate replies, post.

    Args:
        subreddits: Override default subreddit list.
        keywords: Override default keyword list.
        limit: Maximum number of replies to generate this run.
        dry_run: If True, do not actually post replies.
        use_quality_model: Use Claude's quality model for replies.

    Returns:
        List of result dicts.
    """
    print(f"\n{'=' * 60}")
    print(f"ForgeCadNeo Reddit Reply Bot")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"Limit: {limit} replies")
    print(f"{'=' * 60}\n")

    _subreddits = subreddits or DEFAULT_SUBREDDITS
    _keywords = keywords or DEFAULT_KEYWORDS

    # Initialize Claude bot
    try:
        from claude_bot import ClaudeBot
        bot = ClaudeBot()
        if use_quality_model:
            bot.model = bot.quality_model
    except ImportError:
        logger.error(
            "claude_bot module not found. Ensure claude-bot.py is in the same directory."
        )
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to initialize Claude bot: {e}")
        sys.exit(1)

    # Initialize Reddit client
    if not dry_run:
        reddit = create_reddit_client()
    else:
        # For dry-run, we still need Reddit to scan posts (read-only)
        try:
            reddit = create_reddit_client()
        except SystemExit:
            logger.warning(
                "Reddit credentials not available. Using monitor-reddit.py data for dry-run."
            )
            reddit = None

    if reddit is None and not dry_run:
        logger.error("Cannot proceed without Reddit client in live mode.")
        return []

    # Load state
    reply_log = load_reply_log()
    replied_users = load_replied_users()

    # Check rate limits
    ok, reason = can_reply(reply_log)
    if not ok and not dry_run:
        logger.warning(f"Cannot reply right now: {reason}")
        return []

    # Scan for matching posts
    if reddit:
        matches = scan_subreddits(reddit, _subreddits, _keywords)
    else:
        # Fallback: use cached matches from monitor-reddit.py
        matches_file = SCRIPT_DIR / "reddit-matches.json"
        if matches_file.exists():
            cached = load_json_file(matches_file, [])
            matches = [m for m in cached if m.get("hours_old", 99) <= MAX_POST_AGE_HOURS]
            logger.info(f"Using {len(matches)} cached matches from reddit-matches.json")
        else:
            matches = []

    if not matches:
        logger.info("No matching posts found. Nothing to reply to.")
        return []

    # Sort by relevance: higher score + more comments = better engagement target
    matches.sort(key=lambda m: m.get("score", 0) + m.get("num_comments", 0), reverse=True)

    # Limit matches
    matches = matches[:limit]

    results = []
    for i, match in enumerate(matches):
        # Check rate limits before each reply
        if not dry_run:
            ok, reason = can_reply(reply_log)
            if not ok:
                logger.warning(f"Stopping: {reason}")
                break

        # Skip if we already replied to this user
        if match["author"] in replied_users:
            logger.info(f"Skipping u/{match['author']} (already replied to this user)")
            continue

        logger.info(f"\n--- Generating reply {i+1}/{len(matches)} ---")
        logger.info(f"Post: {match['title'][:80]}")
        logger.info(f"Subreddit: r/{match['subreddit']}")
        logger.info(f"Keyword: \"{match['matched_keyword']}\"")

        # Generate reply using Claude
        try:
            reply_text = generate_reply(match, bot)
            if not reply_text or len(reply_text.strip()) < 50:
                logger.warning("Generated reply too short or empty. Skipping.")
                continue
        except Exception as e:
            logger.error(f"Failed to generate reply: {e}")
            continue

        # Submit reply
        result = submit_reply(match, reply_text, dry_run=dry_run)
        results.append(result)

        # Update state
        if result.get("status") == "posted":
            reply_log.append(result)
            replied_users.add(match["author"])
            save_reply_log(reply_log)
            save_replied_users(replied_users)

        # Wait between replies
        if i < len(matches) - 1 and not dry_run:
            wait = MIN_REPLY_INTERVAL_SECONDS
            logger.info(f"Waiting {wait}s before next reply...")
            time.sleep(wait)

    # Summary
    posted = sum(1 for r in results if r.get("status") == "posted")
    dry_runs = sum(1 for r in results if r.get("status") == "dry_run")
    errors = sum(1 for r in results if r.get("status") == "error")

    print(f"\n{'=' * 60}")
    print(f"Reply Bot Summary")
    print(f"{'=' * 60}")
    print(f"Posts scanned:   {len(matches)}")
    print(f"Replies posted:  {posted}")
    print(f"Dry runs:        {dry_runs}")
    print(f"Errors:          {errors}")
    print(f"Replies today:   {get_replies_today(reply_log)}/{MAX_REPLIES_PER_DAY}")
    print(f"{'=' * 60}\n")

    return results


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Reddit Reply Bot — monitors subreddits and generates helpful replies using Claude AI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run: see what replies would be generated
  python reddit-reply-bot.py --dry-run --limit 5

  # Dry-run for a specific subreddit
  python reddit-reply-bot.py --dry-run --subreddit cad --limit 3

  # Run once in live mode (post replies)
  python reddit-reply-bot.py --once --limit 3

  # Run as daemon (checks every 30 minutes)
  python reddit-reply-bot.py --daemon

  # Check status
  python reddit-reply-bot.py --status
        """,
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one scan-and-reply cycle, then exit",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run continuously, checking every 30 minutes",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be replied without posting",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Maximum number of replies per run (default: 5)",
    )
    parser.add_argument(
        "--subreddit",
        type=str,
        nargs="*",
        help="Override target subreddits (space-separated)",
    )
    parser.add_argument(
        "--keywords",
        type=str,
        nargs="*",
        help="Override target keywords (space-separated phrases)",
    )
    parser.add_argument(
        "--quality",
        action="store_true",
        help="Use Claude's higher-quality model for reply generation",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Minutes between daemon checks (default: 30)",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show reply bot status and history",
    )

    args = parser.parse_args()

    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Status command
    if args.status:
        log = load_reply_log()
        replied_users = load_replied_users()
        today_count = get_replies_today(log)
        last_time = get_last_reply_time(log)
        ok, reason = can_reply(log)

        print(f"\nReddit Reply Bot Status")
        print(f"{'=' * 40}")
        print(f"Total replies:     {len(log)}")
        print(f"Replies today:     {today_count}/{MAX_REPLIES_PER_DAY}")
        print(f"Unique users:      {len(replied_users)}")
        print(f"Last reply:        {last_time.isoformat() if last_time else 'Never'}")
        print(f"Can reply now:     {'Yes' if ok else f'No ({reason})'}")
        print()

        if log:
            print("Recent replies:")
            for entry in log[-5:]:
                status = entry.get("status", "?")
                sub = entry.get("subreddit", "?")
                title = entry.get("post_title", "?")[:50]
                ts = entry.get("replied_at", "?")[:19]
                print(f"  [{status}] {ts} r/{sub}: {title}")
        print()
        return

    # Run mode
    subreddits = args.subreddit if args.subreddit else None
    keywords = args.keywords if args.keywords else None

    if args.daemon:
        logger.info(f"Starting daemon mode (check every {args.interval} minutes)")
        logger.info("Press Ctrl+C to stop.\n")
        while True:
            try:
                run_reply_bot(
                    subreddits=subreddits,
                    keywords=keywords,
                    limit=args.limit,
                    dry_run=args.dry_run,
                    use_quality_model=args.quality,
                )
                logger.info(f"Sleeping {args.interval} minutes until next check...")
                time.sleep(args.interval * 60)
            except KeyboardInterrupt:
                logger.info("Daemon stopped.")
                sys.exit(0)
    else:
        # Default: run once
        results = run_reply_bot(
            subreddits=subreddits,
            keywords=keywords,
            limit=args.limit,
            dry_run=args.dry_run,
            use_quality_model=args.quality,
        )
        sys.exit(0 if results else 1)


if __name__ == "__main__":
    main()
