#!/usr/bin/env python3
"""
Content Scheduler for ForgeCadNeo
===================================
Reads from the 30-day content calendar and posts to Reddit, LinkedIn,
and Twitter/X on schedule. Tracks what has been posted in a state file
to avoid duplicate posts.

Content source:
    - 30-day-content-calendar.md  (primary calendar)
    - content-queue.md            (auxiliary queue)

Supported platforms:
    - Reddit (via PRAW)
    - LinkedIn (via LinkedIn API / requests)
    - Twitter/X (via tweepy)

Usage:
    python content-scheduler.py --day 1 --platform reddit --dry-run
    python content-scheduler.py --day 1 --platform all --dry-run
    python content-scheduler.py --today --dry-run
    python content-scheduler.py --post-next --platform linkedin
    python content-scheduler.py --status
    python content-scheduler.py --list

Cron setup (daily at 9 AM):
    0 9 * * * cd /path/to/automation && python3 content-scheduler.py --today >> scheduler.log 2>&1

Environment variables:
    REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
    LINKEDIN_ACCESS_TOKEN
    TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR = Path(__file__).parent.resolve()

# State file
STATE_FILE = SCRIPT_DIR / "scheduler-state.json"

# Content files
CALENDAR_FILE = SCRIPT_DIR / "30-day-content-calendar.md"
QUEUE_FILE = SCRIPT_DIR / "content-queue.md"

# Logger
logger = logging.getLogger("content-scheduler")


# =============================================================================
# STATE MANAGEMENT
# =============================================================================

def load_state() -> dict:
    """Load scheduler state from JSON file."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {"posted": [], "last_run": None}
    return {"posted": [], "last_run": None}


def save_state(state: dict):
    """Save scheduler state to JSON file."""
    state["last_run"] = datetime.now(timezone.utc).isoformat()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def is_day_posted(state: dict, day: int, platform: str) -> bool:
    """Check if a specific day+platform combo has been posted."""
    for entry in state.get("posted", []):
        if entry.get("day") == day and entry.get("platform") == platform:
            return True
    return False


def record_post(state: dict, day: int, platform: str, result: dict):
    """Record a successful post in the state."""
    state.setdefault("posted", []).append({
        "day": day,
        "platform": platform,
        "posted_at": datetime.now(timezone.utc).isoformat(),
        **{k: v for k, v in result.items() if k != "praw_submission"},
    })
    save_state(state)


# =============================================================================
# CALENDAR PARSING
# =============================================================================

def parse_content_calendar(filepath: Path) -> list[dict]:
    """
    Parse the 30-day content calendar markdown file into structured data.

    Expected format:
        ## Day N -- Title
        **Platform:** Reddit profile + LinkedIn + Twitter
        **Theme:** Description of the theme

        ### Post Content
        The actual post content...

        ### Hashtags
        #tag1 #tag2

        ### Cross-post Targets
        r/subreddit1, r/subreddit2
        ---

    Returns:
        List of dicts with keys: day, title, platform, theme, content,
        hashtags, cross_post_targets, visual_suggestion
    """
    if not filepath.exists():
        logger.error(f"Calendar file not found: {filepath}")
        return []

    text = filepath.read_text(encoding="utf-8")
    days = []

    # Split by day headings (## Day N)
    day_pattern = r"##\s+Day\s+(\d+)\s*[\u2014\-]+\s*(.+?)$"
    day_blocks = re.split(r"(?=##\s+Day\s+\d+)", text)

    for block in day_blocks:
        block = block.strip()
        if not block:
            continue

        # Extract day number and title
        day_match = re.search(day_pattern, block, re.MULTILINE)
        if not day_match:
            continue

        day_num = int(day_match.group(1))
        title = day_match.group(2).strip()

        entry = {
            "day": day_num,
            "title": title,
            "platform": "",
            "theme": "",
            "content": "",
            "hashtags": "",
            "cross_post_targets": [],
            "visual_suggestion": "",
        }

        # Extract platform
        platform_match = re.search(
            r"\*\*Platform:\*\*\s*(.+?)$", block, re.MULTILINE
        )
        if platform_match:
            entry["platform"] = platform_match.group(1).strip()

        # Extract theme
        theme_match = re.search(
            r"\*\*Theme:\*\*\s*(.+?)$", block, re.MULTILINE
        )
        if theme_match:
            entry["theme"] = theme_match.group(1).strip()

        # Extract post content
        content_match = re.search(
            r"###\s+Post\s+Content\s*\n(.*?)(?=###|\Z)",
            block,
            re.DOTALL,
        )
        if content_match:
            entry["content"] = content_match.group(1).strip()

        # Extract hashtags
        hashtag_match = re.search(
            r"###\s+Hashtags\s*\n(.+?)(?=###|\Z)", block, re.DOTALL
        )
        if hashtag_match:
            entry["hashtags"] = hashtag_match.group(1).strip()

        # Extract cross-post targets
        crosspost_match = re.search(
            r"###\s+Cross-post\s+Targets\s*\n(.+?)(?=###|\Z)",
            block,
            re.DOTALL,
        )
        if crosspost_match:
            targets_text = crosspost_match.group(1).strip()
            entry["cross_post_targets"] = [
                t.strip().lstrip("r/")
                for t in re.split(r"[,\n]", targets_text)
                if t.strip() and t.strip().startswith("r/")
            ]

        # Extract visual suggestion
        visual_match = re.search(
            r"###\s+Visual.*?Suggestion\s*\n(.*?)(?=###|\Z)",
            block,
            re.DOTALL | re.IGNORECASE,
        )
        if visual_match:
            entry["visual_suggestion"] = visual_match.group(1).strip()

        if entry["content"]:
            days.append(entry)

    logger.info(f"Parsed {len(days)} days from {filepath.name}")
    return days


def parse_content_queue(filepath: Path) -> list[dict]:
    """
    Parse the content-queue.md file.

    Expected format:
        ## Post N -- Description
        - status: pending|posted|scheduled
        - platform: twitter,linkedin
        - scheduled: 2026-03-05
        - twitter: Tweet text
        - linkedin: LinkedIn text
        - hashtags: #tag1 #tag2
        ---
    """
    if not filepath.exists():
        return []

    text = filepath.read_text(encoding="utf-8")
    posts = []
    blocks = re.split(r"\n---+\n", text)

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        post = {}
        lines = block.split("\n")

        for line in lines:
            line = line.strip()
            if line.startswith("## "):
                post["title"] = line.replace("## ", "").strip()
            elif line.startswith("- status:"):
                post["status"] = line.split(":", 1)[1].strip()
            elif line.startswith("- platform:"):
                post["platforms"] = [
                    p.strip() for p in line.split(":", 1)[1].strip().split(",")
                ]
            elif line.startswith("- scheduled:"):
                post["scheduled"] = line.split(":", 1)[1].strip()
            elif line.startswith("- twitter:"):
                post["twitter_text"] = line.split(":", 1)[1].strip()
            elif line.startswith("- linkedin:"):
                post["linkedin_text"] = line.split(":", 1)[1].strip()
            elif line.startswith("- reddit:"):
                post["reddit_text"] = line.split(":", 1)[1].strip()
            elif line.startswith("- hashtags:"):
                post["hashtags"] = line.split(":", 1)[1].strip()

        if post.get("title"):
            posts.append(post)

    return posts


# =============================================================================
# PLATFORM POSTING
# =============================================================================

def post_to_reddit(
    content: str,
    title: str,
    subreddit: str = "",
    hashtags: str = "",
    dry_run: bool = False,
) -> dict:
    """Post content to Reddit."""
    username = os.environ.get("REDDIT_USERNAME", "")

    # Default to user profile
    target = subreddit if subreddit else f"u_{username}"

    result = {
        "platform": "reddit",
        "subreddit": target,
        "title": title,
        "posted_at": datetime.now(timezone.utc).isoformat(),
    }

    if dry_run:
        logger.info(f"[DRY RUN] Reddit r/{target}: {title[:60]}")
        logger.info(f"  Content: {content[:200]}...")
        result["status"] = "dry_run"
        return result

    try:
        import praw

        client_id = os.environ.get("REDDIT_CLIENT_ID", "")
        client_secret = os.environ.get("REDDIT_CLIENT_SECRET", "")
        password = os.environ.get("REDDIT_PASSWORD", "")
        user_agent = os.environ.get(
            "REDDIT_USER_AGENT",
            f"ForgeCadNeo Scheduler v1.0 (by /u/{username})"
        )

        if not all([client_id, client_secret, username, password]):
            result["status"] = "error"
            result["error"] = "Reddit credentials not configured"
            return result

        reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            username=username,
            password=password,
            user_agent=user_agent,
        )

        sub = reddit.subreddit(target)
        submission = sub.submit(title=title, selftext=content)

        result["status"] = "posted"
        result["url"] = f"https://www.reddit.com{submission.permalink}"
        result["id"] = submission.id
        logger.info(f"[POSTED] Reddit r/{target}: {title[:60]}")

    except ImportError:
        result["status"] = "error"
        result["error"] = "praw not installed"
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        logger.error(f"[ERROR] Reddit post failed: {e}")

    return result


def post_to_linkedin(
    content: str,
    hashtags: str = "",
    dry_run: bool = False,
) -> dict:
    """Post content to LinkedIn using the REST API."""
    import requests

    access_token = os.environ.get("LINKEDIN_ACCESS_TOKEN", "")

    result = {
        "platform": "linkedin",
        "posted_at": datetime.now(timezone.utc).isoformat(),
    }

    full_content = content
    if hashtags:
        full_content += f"\n\n{hashtags}"

    if dry_run:
        logger.info(f"[DRY RUN] LinkedIn post:")
        logger.info(f"  Content: {full_content[:200]}...")
        result["status"] = "dry_run"
        return result

    if not access_token:
        result["status"] = "error"
        result["error"] = "LINKEDIN_ACCESS_TOKEN not set"
        logger.warning("LinkedIn access token not configured. Skipping.")
        return result

    try:
        # Get user profile ID
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }

        # Get user URN
        profile_resp = requests.get(
            "https://api.linkedin.com/v2/userinfo",
            headers=headers,
            timeout=10,
        )
        if profile_resp.status_code != 200:
            result["status"] = "error"
            result["error"] = f"LinkedIn profile fetch failed: HTTP {profile_resp.status_code}"
            return result

        user_sub = profile_resp.json().get("sub", "")
        author_urn = f"urn:li:person:{user_sub}"

        # Create post
        post_data = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": full_content},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            },
        }

        resp = requests.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers=headers,
            json=post_data,
            timeout=15,
        )

        if resp.status_code in (200, 201):
            result["status"] = "posted"
            result["id"] = resp.json().get("id", "")
            logger.info(f"[POSTED] LinkedIn post created")
        else:
            result["status"] = "error"
            result["error"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
            logger.error(f"[ERROR] LinkedIn post failed: {resp.status_code}")

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        logger.error(f"[ERROR] LinkedIn post failed: {e}")

    return result


def post_to_twitter(
    content: str,
    hashtags: str = "",
    dry_run: bool = False,
) -> dict:
    """Post content to Twitter/X using tweepy."""
    result = {
        "platform": "twitter",
        "posted_at": datetime.now(timezone.utc).isoformat(),
    }

    # Build tweet text (max 280 chars)
    tweet = content
    if hashtags and len(tweet) + len(hashtags) + 2 <= 280:
        tweet += f"\n\n{hashtags}"
    if len(tweet) > 280:
        tweet = tweet[:277] + "..."

    if dry_run:
        logger.info(f"[DRY RUN] Twitter ({len(tweet)} chars):")
        logger.info(f"  {tweet}")
        result["status"] = "dry_run"
        return result

    api_key = os.environ.get("TWITTER_API_KEY", "")
    api_secret = os.environ.get("TWITTER_API_SECRET", "")
    access_token = os.environ.get("TWITTER_ACCESS_TOKEN", "")
    access_secret = os.environ.get("TWITTER_ACCESS_SECRET", "")

    if not all([api_key, api_secret, access_token, access_secret]):
        result["status"] = "error"
        result["error"] = "Twitter API credentials not configured"
        logger.warning("Twitter credentials not configured. Skipping.")
        return result

    try:
        import tweepy

        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_secret,
        )

        response = client.create_tweet(text=tweet)
        result["status"] = "posted"
        result["id"] = str(response.data["id"])
        result["url"] = f"https://twitter.com/i/status/{result['id']}"
        logger.info(f"[POSTED] Twitter: {tweet[:60]}...")

    except ImportError:
        result["status"] = "error"
        result["error"] = "tweepy not installed"
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        logger.error(f"[ERROR] Twitter post failed: {e}")

    return result


# =============================================================================
# SCHEDULER LOGIC
# =============================================================================

def post_day_content(
    day_num: int,
    platform: str = "all",
    dry_run: bool = False,
    force: bool = False,
) -> list[dict]:
    """
    Post content for a specific day from the calendar.

    Args:
        day_num: Day number (1-30).
        platform: Platform to post to ("reddit", "linkedin", "twitter", "all").
        dry_run: If True, show what would be posted.
        force: If True, post even if already posted.

    Returns:
        List of result dicts.
    """
    days = parse_content_calendar(CALENDAR_FILE)
    if not days:
        logger.error("No content found in calendar")
        return []

    day_entry = next((d for d in days if d["day"] == day_num), None)
    if not day_entry:
        logger.error(f"Day {day_num} not found in calendar. Available days: {[d['day'] for d in days]}")
        return []

    state = load_state()
    results = []

    # Determine target platforms
    calendar_platforms = day_entry.get("platform", "").lower()
    if platform == "all":
        platforms = []
        if "reddit" in calendar_platforms:
            platforms.append("reddit")
        if "linkedin" in calendar_platforms:
            platforms.append("linkedin")
        if "twitter" in calendar_platforms:
            platforms.append("twitter")
        if not platforms:
            platforms = ["reddit", "linkedin", "twitter"]
    else:
        platforms = [platform]

    content = day_entry["content"]
    title = day_entry["title"]
    hashtags = day_entry.get("hashtags", "")
    cross_posts = day_entry.get("cross_post_targets", [])

    print(f"\n{'=' * 60}")
    print(f"Day {day_num}: {title}")
    print(f"Theme: {day_entry.get('theme', 'N/A')}")
    print(f"Platforms: {', '.join(platforms)}")
    print(f"Content: {len(content)} chars")
    if cross_posts:
        print(f"Cross-post targets: {', '.join('r/' + s for s in cross_posts)}")
    print(f"{'=' * 60}")

    for plat in platforms:
        # Check if already posted
        if not force and is_day_posted(state, day_num, plat):
            logger.info(f"[SKIP] Day {day_num} already posted to {plat}")
            continue

        if plat == "reddit":
            # Post to profile first
            result = post_to_reddit(
                content, title, subreddit="", hashtags=hashtags, dry_run=dry_run
            )
            results.append(result)
            if not dry_run and result.get("status") == "posted":
                record_post(state, day_num, "reddit", result)

            # Cross-post to target subreddits
            for target_sub in cross_posts:
                if not dry_run:
                    time.sleep(600)  # 10-minute wait between Reddit posts
                xresult = post_to_reddit(
                    content, title, subreddit=target_sub,
                    hashtags=hashtags, dry_run=dry_run
                )
                xresult["cross_post_from"] = f"day_{day_num}"
                results.append(xresult)
                if not dry_run and xresult.get("status") == "posted":
                    record_post(state, day_num, f"reddit_{target_sub}", xresult)

        elif plat == "linkedin":
            result = post_to_linkedin(content, hashtags=hashtags, dry_run=dry_run)
            results.append(result)
            if not dry_run and result.get("status") == "posted":
                record_post(state, day_num, "linkedin", result)

        elif plat == "twitter":
            # Twitter needs shorter content — use first paragraph or generate
            tweet_content = content.split("\n\n")[0] if content else title
            if len(tweet_content) > 250:
                tweet_content = tweet_content[:247] + "..."
            result = post_to_twitter(tweet_content, hashtags=hashtags, dry_run=dry_run)
            results.append(result)
            if not dry_run and result.get("status") == "posted":
                record_post(state, day_num, "twitter", result)

    return results


def post_today_content(
    platform: str = "all",
    dry_run: bool = False,
) -> list[dict]:
    """
    Determine which day of the calendar corresponds to today and post it.

    Uses the start date defined in the calendar header, or defaults to
    counting from 10 days ago.
    """
    # Try to find the start date from the calendar
    if CALENDAR_FILE.exists():
        header = CALENDAR_FILE.read_text(encoding="utf-8")[:500]
        period_match = re.search(
            r"\*\*Period:\*\*\s*(\w+\s+\d+)", header
        )
        if period_match:
            try:
                from dateutil import parser as dateparser
                start_date = dateparser.parse(period_match.group(1))
                today = datetime.now()
                day_num = (today - start_date).days + 1
                if 1 <= day_num <= 30:
                    logger.info(f"Today is Day {day_num} of the content calendar")
                    return post_day_content(day_num, platform, dry_run)
                else:
                    logger.warning(
                        f"Today (Day {day_num}) is outside the 30-day calendar range"
                    )
                    return []
            except (ImportError, ValueError):
                pass

    # Fallback: check state for the next unposted day
    state = load_state()
    posted_days = {
        entry["day"]
        for entry in state.get("posted", [])
        if entry.get("platform") in ("reddit", "linkedin", "twitter")
    }

    for day_num in range(1, 31):
        if day_num not in posted_days:
            logger.info(f"Next unposted day: Day {day_num}")
            return post_day_content(day_num, platform, dry_run)

    logger.info("All 30 days have been posted.")
    return []


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Content Scheduler for ForgeCadNeo — posts from the 30-day content calendar",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all days in the calendar
  python content-scheduler.py --list

  # Dry-run a specific day
  python content-scheduler.py --day 1 --platform reddit --dry-run

  # Post all platforms for a day
  python content-scheduler.py --day 5 --platform all --dry-run

  # Post today's content
  python content-scheduler.py --today --dry-run

  # Post the next unposted day
  python content-scheduler.py --post-next --dry-run

  # Check status
  python content-scheduler.py --status

  # Force re-post a day
  python content-scheduler.py --day 3 --platform linkedin --force
        """,
    )
    parser.add_argument(
        "--day",
        type=int,
        metavar="N",
        help="Post content for a specific day (1-30)",
    )
    parser.add_argument(
        "--today",
        action="store_true",
        help="Automatically determine today's day and post",
    )
    parser.add_argument(
        "--post-next",
        action="store_true",
        help="Post the next unposted day",
    )
    parser.add_argument(
        "--platform",
        type=str,
        default="all",
        choices=["reddit", "linkedin", "twitter", "all"],
        help="Target platform (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be posted without actually posting",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Post even if already posted for this day/platform",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all days in the content calendar",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show scheduler state and posting history",
    )
    parser.add_argument(
        "--calendar",
        type=str,
        help="Override calendar file path",
    )

    args = parser.parse_args()

    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Override calendar file if specified
    global CALENDAR_FILE
    if args.calendar:
        cal_path = Path(args.calendar)
        if not cal_path.is_absolute():
            cal_path = SCRIPT_DIR / cal_path
        CALENDAR_FILE = cal_path

    # Status command
    if args.status:
        state = load_state()
        posted = state.get("posted", [])

        print(f"\nContent Scheduler Status")
        print(f"{'=' * 50}")
        print(f"Calendar:    {CALENDAR_FILE.name}")
        print(f"State file:  {STATE_FILE.name}")
        print(f"Last run:    {state.get('last_run', 'Never')}")
        print(f"Total posts: {len(posted)}")
        print()

        if posted:
            # Group by day
            by_day = {}
            for entry in posted:
                day = entry.get("day", "?")
                by_day.setdefault(day, []).append(entry)

            print("Posted days:")
            for day in sorted(by_day.keys()):
                entries = by_day[day]
                platforms = [e.get("platform", "?") for e in entries]
                statuses = [e.get("status", "?") for e in entries]
                print(f"  Day {day}: {', '.join(platforms)} ({', '.join(statuses)})")
        print()
        return

    # List command
    if args.list:
        days = parse_content_calendar(CALENDAR_FILE)
        state = load_state()

        print(f"\n30-Day Content Calendar")
        print(f"{'=' * 60}")
        for day in days:
            day_num = day["day"]
            title = day["title"][:50]
            platforms = day.get("platform", "N/A")

            # Check posted status
            posted_platforms = []
            for plat in ["reddit", "linkedin", "twitter"]:
                if is_day_posted(state, day_num, plat):
                    posted_platforms.append(plat)

            status = f"POSTED ({', '.join(posted_platforms)})" if posted_platforms else "PENDING"
            print(f"  Day {day_num:2d} [{status:30s}] {title}")

        print(f"\nTotal: {len(days)} days parsed")
        print()
        return

    # Posting commands
    if args.day is not None:
        results = post_day_content(
            args.day, args.platform, args.dry_run, args.force
        )
    elif args.today:
        results = post_today_content(args.platform, args.dry_run)
    elif args.post_next:
        results = post_today_content(args.platform, args.dry_run)
    else:
        parser.print_help()
        return

    # Summary
    if results:
        print(f"\n{'=' * 60}")
        print(f"Scheduler Results")
        print(f"{'=' * 60}")
        for r in results:
            status = r.get("status", "?")
            platform = r.get("platform", "?")
            url = r.get("url", "")
            error = r.get("error", "")
            print(f"  [{status.upper():8s}] {platform}: {url or error or 'OK'}")
        print()


if __name__ == "__main__":
    main()
